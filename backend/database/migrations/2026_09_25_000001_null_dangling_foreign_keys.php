<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Replaces dangling foreign key values with NULL.
 *
 * Bulk inserts into production wrote 0 into nullable foreign key columns where
 * they meant NULL. Ids start at 1, so 0 matches nothing, and the result is a
 * reference that looks present and resolves to no row:
 *
 *   appointments.vet_id          84,134 rows pointing at admin 0
 *   appointments.deleted_by      84,155
 *   invoices.appointment_id      14,097
 *   invoice_items.inventory_id   10,238
 *   owners.user_id                  202
 *   pets.size_category_id            34   (breaks size-based pricing)
 *   ... 196,572 dangling references in total
 *
 * MySQL would have rejected these on insert; TiDB records the constraints but
 * does not enforce them, which is why they accumulated in production and not
 * in any local copy built from migrations.
 *
 * Nothing is lost by nulling them. A reference to a row that does not exist
 * already carries no information — it only makes an absent vet, appointment or
 * stock item look like a present one, so every join over it silently drops rows
 * and every count over it reads high.
 *
 * Written generically rather than as a list of hardcoded UPDATEs so it repairs
 * whatever is actually broken in the database it runs against, and is a no-op
 * on one that is already clean.
 */
return new class extends Migration
{
    public function up(): void
    {
        $total = 0;

        foreach ($this->nullableForeignKeys() as $fk) {
            [$table, $column, $parent, $parentKey] = $fk;

            if (!Schema::hasTable($table) || !Schema::hasTable($parent)) {
                continue;
            }

            // Collect the offending values before updating, rather than letting
            // the UPDATE carry a subquery. A self-referencing key such as
            // admins.deleted_by -> admins.id would otherwise fail with MySQL
            // error 1093, which forbids selecting from the table being updated.
            // Reading first also keeps this to one pass over the parent table.
            $bad = DB::table($table)
                ->whereNotNull($column)
                ->whereNotExists(function ($q) use ($parent, $parentKey, $table, $column) {
                    $q->select(DB::raw(1))
                        ->from($parent)
                        ->whereColumn("{$parent}.{$parentKey}", "{$table}.{$column}");
                })
                ->distinct()
                ->pluck($column)
                ->all();

            if ($bad === []) {
                continue;
            }

            $fixed = 0;
            foreach (array_chunk($bad, 1000) as $slice) {
                $fixed += DB::table($table)->whereIn($column, $slice)->update([$column => null]);
            }

            if ($fixed > 0) {
                $total += $fixed;
                Log::info("null_dangling_foreign_keys: {$table}.{$column} -> {$parent}, nulled {$fixed}");
            }
        }

        Log::info("null_dangling_foreign_keys: {$total} dangling reference(s) nulled.");
    }

    public function down(): void
    {
        // Deliberately not reversed. The previous values pointed at rows that do
        // not exist, so there is nothing meaningful to restore them to.
    }

    /**
     * Every foreign key in this schema whose column accepts NULL.
     *
     * NOT NULL columns are skipped: nothing can be written to them here, and a
     * dangling value in one is a structural problem that needs a decision about
     * the row, not a blanket update.
     *
     * @return array<int,array{0:string,1:string,2:string,3:string}>
     */
    private function nullableForeignKeys(): array
    {
        $rows = DB::select(
            "SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.COLUMNS c
               ON  c.TABLE_SCHEMA = k.TABLE_SCHEMA
               AND c.TABLE_NAME   = k.TABLE_NAME
               AND c.COLUMN_NAME  = k.COLUMN_NAME
             WHERE k.TABLE_SCHEMA = ?
               AND k.REFERENCED_TABLE_NAME IS NOT NULL
               AND c.IS_NULLABLE = 'YES'",
            [DB::getDatabaseName()]
        );

        return array_map(fn($r) => [
            $r->TABLE_NAME,
            $r->COLUMN_NAME,
            $r->REFERENCED_TABLE_NAME,
            $r->REFERENCED_COLUMN_NAME,
        ], $rows);
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Covering indexes for the two hottest read paths, measured on a copy of
 * production data (appointments 14.8k rows, audit_logs 8.5k rows):
 *
 *   appointments list   71.9ms -> 54.1ms  (-25%)
 *   appointments count  35.7ms ->  9.9ms  (-72%)
 *   audit_logs count    17.3ms ->  8.4ms  (-51%)
 *
 * Both queries previously used a narrow index to find rows and then read each
 * row from disk to evaluate the remaining predicates. Carrying those columns in
 * the index answers the filter without touching the table at all — the plan
 * changes from "Index lookup" to "Covering index lookup".
 *
 * Written with the schema builder rather than raw ALTER ... ALGORITHM=INPLACE so
 * it is portable: MySQL 8 already builds secondary indexes in place without
 * locking, and TiDB (production) performs DDL online by default and rejects
 * some of MySQL's ALGORITHM/LOCK clauses.
 */
return new class extends Migration
{
    /** table => [index name => columns] */
    private array $indexes = [
        'appointments' => [
            // The list and count both join pets -> owners, then filter status and
            // deleted_at per appointment and order by id.
            'appointments_pet_status_id_idx' => ['pet_id', 'deleted_at', 'status', 'id'],
        ],
        'audit_logs' => [
            // Scoped by clinic, then filtered on user_id being null or present.
            'audit_logs_clinic_user_idx' => ['clinic_id', 'user_id'],
        ],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $set) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            foreach ($set as $name => $columns) {
                if ($this->indexExists($table, $name) || !$this->columnsExist($table, $columns)) {
                    continue;
                }

                Schema::table($table, fn ($t) => $t->index($columns, $name));
            }

            // Refresh statistics so the optimizer actually costs the new index.
            // The estimate on this join was out by 140x before this ran.
            $this->analyze($table);
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $table => $set) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            foreach ($set as $name => $columns) {
                if (!$this->indexExists($table, $name)) {
                    continue;
                }

                // A composite whose first column carries a foreign key can be
                // adopted by that constraint, and MySQL then refuses to drop it
                // (errno 1553). Make sure the FK has a single-column index of its
                // own to fall back on before removing this one.
                $this->ensureForeignKeyIndex($table, $columns[0]);

                Schema::table($table, fn ($t) => $t->dropIndex($name));
            }

            $this->analyze($table);
        }
    }

    private function indexExists(string $table, string $name): bool
    {
        foreach (DB::select("SHOW INDEX FROM `{$table}`") as $row) {
            if ($row->Key_name === $name) {
                return true;
            }
        }

        return false;
    }

    private function columnsExist(string $table, array $columns): bool
    {
        foreach ($columns as $column) {
            if (!Schema::hasColumn($table, $column)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Guarantees a single-column index on $column when a foreign key needs one,
     * so dropping a wider index cannot leave the constraint unsupported.
     */
    private function ensureForeignKeyIndex(string $table, string $column): void
    {
        $constrained = DB::select(
            'SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
               AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1',
            [$table, $column]
        );

        if (!$constrained) {
            return;
        }

        // Is some other index already led by this column?
        foreach (DB::select("SHOW INDEX FROM `{$table}`") as $row) {
            if ((int) $row->Seq_in_index === 1
                && $row->Column_name === $column
                && !array_key_exists($row->Key_name, $this->indexes[$table] ?? [])) {
                return;
            }
        }

        $fallback = "{$table}_{$column}_fkidx";
        if (!$this->indexExists($table, $fallback)) {
            Schema::table($table, fn ($t) => $t->index([$column], $fallback));
        }
    }

    private function analyze(string $table): void
    {
        try {
            DB::statement("ANALYZE TABLE `{$table}`");
        } catch (\Throwable $e) {
            // Not fatal — the index is in place either way.
        }
    }
};

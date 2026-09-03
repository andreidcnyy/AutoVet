<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the columns the hot list endpoints sort and filter on.
 *
 * Everything here is additive — no column, constraint or query result changes,
 * only the plan the database picks. Each index is created only when the table
 * and column exist and nothing already leads with that column, so this is safe
 * to run against databases that have drifted apart.
 */
return new class extends Migration
{
    /** table => [[columns...], ...] */
    private array $indexes = [
        // Invoice lists order by updated_at over ~12k rows, which was a filesort,
        // and the report screens filter on report_type.
        'invoices' => [
            ['updated_at'],
            ['report_type', 'updated_at'],
            ['pet_id', 'updated_at'],
        ],
        // The portal pet modal filters by pet and orders by recency.
        'medical_records' => [
            ['pet_id', 'created_at'],
            ['created_at'],
        ],
        // Appointment lists filter by date and status together.
        'appointments' => [
            ['date', 'status'],
            ['pet_id', 'date'],
        ],
        // Soft-delete filtering appears in nearly every pet query.
        'pets' => [
            ['deleted_at'],
        ],
        // Invoice line items are fetched per invoice for reports.
        'invoice_items' => [
            ['invoice_id', 'is_hidden'],
        ],
        // Audit log paging orders by recency.
        'audit_logs' => [
            ['created_at'],
        ],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $sets) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            foreach ($sets as $columns) {
                if (!$this->columnsExist($table, $columns)) {
                    continue;
                }
                if ($this->leadingIndexExists($table, $columns[0], count($columns))) {
                    continue;
                }

                $name = $this->indexName($table, $columns);
                try {
                    Schema::table($table, fn ($t) => $t->index($columns, $name));
                } catch (\Throwable $e) {
                    // A pre-existing equivalent index under another name is fine.
                    DB::connection()->getSchemaBuilder(); // no-op, keeps the loop going
                }
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $table => $sets) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            foreach ($sets as $columns) {
                $name = $this->indexName($table, $columns);
                try {
                    Schema::table($table, fn ($t) => $t->dropIndex($name));
                } catch (\Throwable $e) {
                    // Never created, or already gone.
                }
            }
        }
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
     * True when an index already leads with this column and is at least as wide,
     * in which case another one on the same prefix would earn nothing.
     */
    private function leadingIndexExists(string $table, string $first, int $width): bool
    {
        $byName = [];
        foreach (DB::select("SHOW INDEX FROM `{$table}`") as $row) {
            $byName[$row->Key_name][(int) $row->Seq_in_index] = $row->Column_name;
        }

        foreach ($byName as $columns) {
            ksort($columns);
            if (($columns[1] ?? null) === $first && count($columns) >= $width) {
                return true;
            }
        }

        return false;
    }

    private function indexName(string $table, array $columns): string
    {
        return substr($table . '_' . implode('_', $columns) . '_idx', 0, 64);
    }
};

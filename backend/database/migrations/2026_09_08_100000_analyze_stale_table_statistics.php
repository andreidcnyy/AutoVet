<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Collects optimizer statistics for tables that have never had any.
 *
 * The two index migrations that came before this one each ran ANALYZE, but
 * only on the tables they added indexes to — appointments, audit_logs,
 * invoices, invoice_items. `pets` and `owners` were never analyzed at all:
 *
 *   SHOW STATS_META (production, before this ran)
 *     appointments   row_count=84176  last_analyze=2026-09-04 08:43:15
 *     invoices       row_count=14145  last_analyze=2026-09-03 12:12:58
 *     pets           row_count=114    last_analyze=(empty)
 *     owners         row_count=222    last_analyze=(empty)
 *
 * Both sit inside the correlated subquery that every appointment, pet and
 * invoice listing runs to hide seeded rows, and TiDB was costing that branch
 * with made-up numbers — the plan showed `stats:pseudo` against both, with
 * estRows of 0.00 and 0.11 for tables holding 114 and 222 rows.
 *
 * Measured effect on the appointments list is real but modest: 276.5ms ->
 * 253.7ms (-8.3%), because the dominant cost there is a full scan of the
 * 84k-row appointments table that statistics alone do not remove. The reason
 * to run it anyway is plan stability — pseudo statistics can push the
 * optimizer into a much worse join order on any query touching these two
 * tables, and there are many.
 *
 * Statistics are not schema. This adds no column, index or constraint, and
 * changes no query result — only how the optimizer costs a plan.
 */
return new class extends Migration
{
    /** Tables whose statistics this migration refreshes. */
    private array $tables = ['pets', 'owners'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $this->analyze($table);
        }
    }

    /**
     * Nothing to undo. Statistics are derived data, not schema: there is no
     * "uncollect", and restoring the previous pseudo-stats would only put the
     * optimizer back to guessing. Left deliberately empty so the migration is
     * still reversible in the sense that matters — rolling back leaves a
     * working database.
     */
    public function down(): void
    {
        //
    }

    /**
     * ANALYZE is naturally idempotent, so this needs no existence check beyond
     * the table itself. Failures are swallowed for the same reason the earlier
     * index migrations swallow them: a deploy must not fall over because the
     * optimizer declined to refresh a histogram.
     */
    private function analyze(string $table): void
    {
        try {
            DB::statement("ANALYZE TABLE `{$table}`");
        } catch (\Throwable $e) {
            // Not fatal — the previous statistics, or none, remain in place.
        }
    }
};

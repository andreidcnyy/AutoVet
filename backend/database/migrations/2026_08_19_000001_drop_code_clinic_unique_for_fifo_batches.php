<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * FIFO treats every row sharing a product `code` as a batch of that product,
 * consuming the oldest first. That requires several rows per code.
 *
 * 2026_04_24_054546 replaced unique(code) with unique(code, clinic_id) when
 * tenancy was added, and 2026_06_16_062344 — which meant to lift the
 * restriction — looked for an index named `inventories_code_unique`, which by
 * then no longer existed. It matched nothing, dropped nothing, and recorded
 * itself as run. The constraint survived and a second batch was impossible to
 * insert.
 *
 * So this migration deliberately does NOT match on index names: it finds any
 * unique index that covers `code` and drops it by whatever name the database
 * actually reports, then verifies the result. A name-based check that silently
 * matches nothing is exactly how this bug survived the first attempt to fix it.
 */
return new class extends Migration
{
    /**
     * Unique indexes that constrain `code` — whatever they happen to be called.
     * A unique index on (code) or (code, clinic_id) both block multiple batches;
     * one on (sku) or (uuid) does not.
     */
    private function blockingUniqueIndexes(): array
    {
        return collect(Schema::getIndexes('inventories'))
            ->filter(fn($i) => ($i['unique'] ?? false) && in_array('code', $i['columns'], true))
            ->pluck('name')
            ->all();
    }

    private function indexExistsNamed(string $name): bool
    {
        return collect(Schema::getIndexes('inventories'))
            ->contains(fn($i) => $i['name'] === $name);
    }

    /**
     * Echo to the deploy log as well as the app log. This runs from the
     * container start command on Render, so stdout is what actually gets seen;
     * silence here is indistinguishable from a no-op, which is the failure this
     * migration exists to rule out.
     */
    private function report(string $line): void
    {
        echo "[fifo-batches] {$line}\n";
        Log::info("[fifo-batches] {$line}");
    }

    public function up(): void
    {
        // Add the replacement index first so `code` is never left unindexed —
        // FIFO looks batches up by code on every invoice finalization.
        if (!$this->indexExistsNamed('inventories_code_clinic_id_index')) {
            Schema::table('inventories', function (Blueprint $table) {
                $table->index(['code', 'clinic_id']);
            });
            $this->report('created index inventories_code_clinic_id_index');
        } else {
            $this->report('index inventories_code_clinic_id_index already present');
        }

        $found = $this->blockingUniqueIndexes();
        $this->report($found
            ? 'unique index(es) constraining code: ' . implode(', ', $found)
            : 'no unique index constrains code (nothing to drop)');

        foreach ($found as $name) {
            // Each drop is its own ALTER TABLE: TiDB rejects multiple changes to
            // the same object in a single statement.
            Schema::table('inventories', function (Blueprint $table) use ($name) {
                $table->dropUnique($name);
            });
            $this->report("dropped unique index {$name}");
        }

        // Fail loudly rather than leave a half-applied schema recorded as "Ran".
        $remaining = $this->blockingUniqueIndexes();
        if (!empty($remaining)) {
            throw new \RuntimeException(
                'Could not drop unique index(es) on inventories.code: ' . implode(', ', $remaining)
                . '. FIFO batching requires multiple rows per code.'
            );
        }

        $this->report('OK — code is no longer unique; FIFO batching is possible');
    }

    public function down(): void
    {
        // Only restorable while no product actually holds multiple batches;
        // re-adding the constraint over real batch data would fail anyway, so
        // say so clearly instead of surfacing a duplicate-key error.
        $dupes = DB::table('inventories')
            ->whereNotNull('code')
            ->where('code', '!=', '')
            ->select('code', 'clinic_id', DB::raw('COUNT(*) as n'))
            ->groupBy('code', 'clinic_id')
            ->having('n', '>', 1)
            ->count();

        if ($dupes > 0) {
            throw new \RuntimeException(
                "Cannot restore unique(code, clinic_id): {$dupes} product(s) already have multiple batches. "
                . 'Consolidate batches before rolling this migration back.'
            );
        }

        if ($this->indexExistsNamed('inventories_code_clinic_id_index')) {
            Schema::table('inventories', function (Blueprint $table) {
                $table->dropIndex('inventories_code_clinic_id_index');
            });
        }

        Schema::table('inventories', function (Blueprint $table) {
            $table->unique(['code', 'clinic_id']);
        });
    }
};

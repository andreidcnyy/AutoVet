<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FIFO treats every row sharing a product `code` as a batch of that product,
 * consuming the oldest first. That requires several rows per code.
 *
 * 2026_04_24_054546 replaced unique(code) with unique(code, clinic_id) when
 * tenancy was added, and 2026_06_16_062344 — which meant to lift the
 * restriction — only looked for an index named `inventories_code_unique`,
 * which by then no longer existed. So the composite constraint survived and
 * a second batch was physically impossible to insert.
 */
return new class extends Migration
{
    private function indexExists(string $name): bool
    {
        return collect(Schema::getIndexes('inventories'))
            ->contains(fn($index) => $index['name'] === $name);
    }

    public function up(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            if ($this->indexExists('inventories_code_clinic_id_unique')) {
                $table->dropUnique('inventories_code_clinic_id_unique');
            }
        });

        // Keep the pair indexed — FIFO looks batches up by code on every
        // finalization — just without the uniqueness.
        Schema::table('inventories', function (Blueprint $table) {
            if (!$this->indexExists('inventories_code_clinic_id_index')) {
                $table->index(['code', 'clinic_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            if ($this->indexExists('inventories_code_clinic_id_index')) {
                $table->dropIndex('inventories_code_clinic_id_index');
            }
        });

        // Only restorable while no product actually has multiple batches.
        Schema::table('inventories', function (Blueprint $table) {
            if (!$this->indexExists('inventories_code_clinic_id_unique')) {
                $table->unique(['code', 'clinic_id']);
            }
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First, ensure all existing items have a code if they don't already
        DB::table('inventories')->whereNull('code')->chunkById(100, function ($items) {
            foreach ($items as $item) {
                DB::table('inventories')
                    ->where('id', $item->id)
                    ->update(['code' => 'INV-AUTOGEN-' . str_pad($item->id, 5, '0', STR_PAD_LEFT)]);
            }
        });

        Schema::table('inventories', function (Blueprint $table) {
            $table->string('code')->unique()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventories', function (Blueprint $table) {
            $table->string('code')->nullable()->unique(false)->change();
            // Note: uniqueness removal handling depends on DB driver, but unique(false) is not a standard Laravel method.
            // Usually we drop the index.
            $table->dropUnique(['code']);
        });
    }
};

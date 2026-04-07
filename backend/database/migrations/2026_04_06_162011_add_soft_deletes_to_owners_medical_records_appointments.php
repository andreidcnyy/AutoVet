<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Owner only needs softDeletes
        Schema::table('owners', function (Blueprint $table) {
            if (!Schema::hasColumn('owners', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        // Appointments and Medical Records need softDeletes + Archivable fields
        $fullTables = ['appointments', 'medical_records'];
        foreach ($fullTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::hasColumn($tableName, 'deleted_at')) {
                    $table->softDeletes();
                }
                if (!Schema::hasColumn($tableName, 'deleted_by')) {
                    $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
                }
                if (!Schema::hasColumn($tableName, 'restore_until')) {
                    $table->timestamp('restore_until')->nullable();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('owners', function (Blueprint $table) {
            if (Schema::hasColumn('owners', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });

        $fullTables = ['appointments', 'medical_records'];
        foreach ($fullTables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (Schema::hasColumn($tableName, 'restore_until')) {
                    $table->dropColumn('restore_until');
                }
                if (Schema::hasColumn($tableName, 'deleted_by')) {
                    $table->dropForeign([$tableName . '_deleted_by_foreign']);
                    $table->dropColumn('deleted_by');
                }
                if (Schema::hasColumn($tableName, 'deleted_at')) {
                    $table->dropSoftDeletes();
                }
            });
        }
    }
};

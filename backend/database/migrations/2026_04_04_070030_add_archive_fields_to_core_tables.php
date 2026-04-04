<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $tables = [
        'pets', 'owners', 'services', 'inventories', 'users', 'cms_contents'
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) {
                    if (!Schema::hasColumn($table->getTable(), 'deleted_by')) {
                        $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
                    }
                    if (!Schema::hasColumn($table->getTable(), 'restore_until')) {
                        $table->timestamp('restore_until')->nullable();
                    }
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    if (Schema::hasColumn($tableName, 'restore_until')) {
                        $table->dropColumn('restore_until');
                    }
                    if (Schema::hasColumn($tableName, 'deleted_by')) {
                        $table->dropForeign([$tableName . '_deleted_by_foreign']);
                        $table->dropColumn('deleted_by');
                    }
                });
            }
        }
    }
};

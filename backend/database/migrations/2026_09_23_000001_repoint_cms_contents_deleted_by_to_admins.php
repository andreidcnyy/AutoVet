<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * cms_contents.deleted_by still points at `users`, a table that
 * 2026_04_09_050002_drop_users_table removed. The migration that moved every
 * other archive key over to `admins`
 * (2026_04_09_060000_fix_all_user_foreign_keys) simply missed this table, so
 * the constraint has been dangling ever since and archiving a CMS entry would
 * fail against a parent table that no longer exists.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('cms_contents') || !Schema::hasColumn('cms_contents', 'deleted_by')) {
            return;
        }

        if (!$this->hasForeignKey('cms_contents', 'cms_contents_deleted_by_foreign')) {
            return;
        }

        Schema::table('cms_contents', function (Blueprint $table) {
            $table->dropForeign('cms_contents_deleted_by_foreign');
        });

        // Any value left over cannot match an admin, so clear it before the new
        // constraint is applied.
        DB::table('cms_contents')
            ->whereNotNull('deleted_by')
            ->whereNotIn('deleted_by', DB::table('admins')->select('id'))
            ->update(['deleted_by' => null]);

        Schema::table('cms_contents', function (Blueprint $table) {
            $table->foreign('deleted_by')->references('id')->on('admins')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Deliberately not reversed: `users` no longer exists, so the previous
        // constraint cannot be recreated.
    }

    private function hasForeignKey(string $table, string $constraint): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraint)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }
};

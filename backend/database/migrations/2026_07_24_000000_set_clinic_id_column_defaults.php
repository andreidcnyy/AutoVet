<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fresh-install seeding fix.
 *
 * The seeders (and some app paths) create clinic-scoped rows without an explicit
 * clinic_id, relying on the HasClinic trait to fill it from the authenticated
 * user. During `db:seed` there is no auth context, so clinic_id was omitted — and
 * on strict, FK-enforcing TiDB the inserts failed ("clinic_id has no default value"
 * / foreign key violation), whereas the old permissive MySQL silently used 0.
 *
 * Give every clinic_id column a database-level DEFAULT of the primary clinic id so
 * ANY insert style (Eloquent create, bulk insert(), raw) that omits clinic_id lands
 * on a valid, query-visible clinic. Authenticated runtime creates still set
 * clinic_id explicitly via HasClinic, so this default only applies when it's omitted.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Prefer the existing seeded clinic; fall back to 1 on a truly fresh DB.
        $clinicId = optional(DB::table('clinics')->orderBy('id')->first())->id ?? 1;

        foreach ($this->clinicIdTables() as $table) {
            DB::statement("ALTER TABLE `{$table}` ALTER COLUMN `clinic_id` SET DEFAULT {$clinicId}");
        }
    }

    public function down(): void
    {
        foreach ($this->clinicIdTables() as $table) {
            DB::statement("ALTER TABLE `{$table}` ALTER COLUMN `clinic_id` DROP DEFAULT");
        }
    }

    /** All tables in this schema that have a clinic_id column. */
    private function clinicIdTables(): array
    {
        return array_map(
            static fn ($row) => $row->table_name,
            DB::select(
                "SELECT TABLE_NAME AS table_name
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'clinic_id'"
            )
        );
    }
};

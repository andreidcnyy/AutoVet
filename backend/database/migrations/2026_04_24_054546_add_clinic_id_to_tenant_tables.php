<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tables = [
            'admins',
            'portal_users',
            'owners',
            'pets',
            'appointments',
            'invoices',
            'inventories',
            'inventory_transactions',
            'inventory_usage_history',
            'inventory_forecasts',
            'services',
            'medical_records',
            'notifications',
            'client_notifications',
            'audit_logs',
            'vet_schedules',
            'settings',
            'cms_contents',
        ];

        // 1. Add nullable clinic_id column to all tables
        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->foreignId('clinic_id')->nullable()->after('id')->constrained('clinics')->onDelete('cascade');
            });
        }

        // 2. Seed the default clinic
        $clinicId = DB::table('clinics')->insertGetId([
            'clinic_name' => 'Petwellness Animal Clinic',
            'email' => 'admin@petwellness.com',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. Update all existing records to use the default clinic
        foreach ($tables as $table) {
            DB::table($table)->update(['clinic_id' => $clinicId]);
        }

        // 3.1 Update existing 'admin' roles to 'clinic_admin'
        DB::table('admins')->where('role', 'admin')->update(['role' => 'clinic_admin']);

        // 3.2 Create a default super_admin account
        DB::table('admins')->insert([
            'name' => 'System Super Admin',
            'email' => 'superadmin@autovet.com',
            'password' => Hash::make('password'),
            'role' => 'super_admin',
            'status' => 'active',
            'clinic_id' => $clinicId, // Even super_admin needs a clinic context for some things, though they see all.
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4. Make clinic_id non-nullable for core tables
        foreach ($tables as $table) {
             Schema::table($table, function (Blueprint $table) {
                $table->unsignedBigInteger('clinic_id')->nullable(false)->change();
            });
        }

        // 5. Update unique constraints for users
        Schema::table('admins', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->unique(['email', 'clinic_id']);
        });

        Schema::table('portal_users', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->unique(['email', 'clinic_id']);
        });

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->unique(['code', 'clinic_id']);
        });
    }

    public function down(): void
    {
        $tables = [
            'admins',
            'portal_users',
            'owners',
            'pets',
            'appointments',
            'invoices',
            'inventories',
            'inventory_transactions',
            'inventory_usage_history',
            'inventory_forecasts',
            'services',
            'medical_records',
            'notifications',
            'client_notifications',
            'audit_logs',
            'vet_schedules',
            'settings',
            'cms_contents',
        ];

        Schema::table('inventories', function (Blueprint $table) {
            $table->dropUnique(['code', 'clinic_id']);
            $table->unique('code');
        });

        Schema::table('portal_users', function (Blueprint $table) {
            $table->dropUnique(['email', 'clinic_id']);
            $table->unique('email');
        });

        Schema::table('admins', function (Blueprint $table) {
            $table->dropUnique(['email', 'clinic_id']);
            $table->unique('email');
        });

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['clinic_id']);
                $table->dropColumn('clinic_id');
            });
        }
    }
};

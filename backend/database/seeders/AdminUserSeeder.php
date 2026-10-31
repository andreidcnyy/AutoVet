<?php

namespace Database\Seeders;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Clinic;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $clinic = Clinic::first();

        Admin::updateOrCreate(
            ['email' => 'admin@autovet.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password123'),
                'role' => Roles::CLINIC_ADMIN->value,
                'status' => 'active',
                'clinic_id' => $clinic->id,
            ]
        );
    }
}

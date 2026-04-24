<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Models\Owner;
use App\Models\Clinic;
use App\Enums\Roles;

class SeparateUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $clinic = Clinic::first();

        // 1. Create the Admin User
        Admin::updateOrCreate(
            ['email' => 'admin@autovet.com', 'clinic_id' => $clinic->id],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password123'),
                'role' => Roles::CLINIC_ADMIN->value,
                'status' => 'active',
                'clinic_id' => $clinic->id,
            ]
        );

        // 2. Create the Portal User
        $portalUser = PortalUser::updateOrCreate(
            ['email' => 'portal@autovet.com', 'clinic_id' => $clinic->id],
            [
                'name' => 'John Doe',
                'password' => Hash::make('password123'),
                'status' => 'active',
                'clinic_id' => $clinic->id,
            ]
        );

        // 3. Ensure the associated Owner record exists and points to this portal user
        Owner::updateOrCreate(
            ['email' => 'portal@autovet.com', 'clinic_id' => $clinic->id],
            [
                'name' => 'John Doe',
                'user_id' => $portalUser->id,
                'phone' => '1234567890',
                'address' => '123 Pet St',
                'clinic_id' => $clinic->id,
            ]
        );
    }
}

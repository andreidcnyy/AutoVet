<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Models\Owner;
use App\Enums\Roles;

class SeparateUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create the Admin User
        Admin::updateOrCreate(
            ['email' => 'admin@autovet.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password123'),
                'role' => Roles::ADMIN->value,
                'status' => 'active',
            ]
        );

        // 2. Create the Portal User
        $portalUser = PortalUser::updateOrCreate(
            ['email' => 'portal@autovet.com'],
            [
                'name' => 'John Doe',
                'password' => Hash::make('password123'),
                'status' => 'active',
            ]
        );

        // 3. Ensure the associated Owner record exists and points to this portal user
        Owner::updateOrCreate(
            ['email' => 'portal@autovet.com'],
            [
                'name' => 'John Doe',
                'user_id' => $portalUser->id,
                'phone' => '1234567890',
                'address' => '123 Pet St',
            ]
        );
    }
}

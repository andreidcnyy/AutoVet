<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Models\Owner;
use App\Enums\Roles;

class FinalUserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create fresh Admin
        Admin::updateOrCreate(
            ['email' => 'test-admin@autovet.com'],
            [
                'name' => 'Test Admin',
                'password' => Hash::make('password123'),
                'role' => Roles::ADMIN->value,
                'status' => 'active',
            ]
        );

        // 2. Create fresh Portal User
        $portalUser = PortalUser::updateOrCreate(
            ['email' => 'test-portal@autovet.com'],
            [
                'name' => 'Test Owner',
                'password' => Hash::make('password123'),
                'status' => 'active',
            ]
        );

        // 3. Associate with Owner record
        Owner::updateOrCreate(
            ['email' => 'test-portal@autovet.com'],
            [
                'name' => 'Test Owner',
                'user_id' => $portalUser->id,
                'phone' => '09123456789',
                'address' => 'Validation St.',
            ]
        );
    }
}

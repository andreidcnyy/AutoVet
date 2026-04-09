<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Owner;
use App\Enums\Roles;

class PortalUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Create the Portal User
        $user = User::updateOrCreate(
            ['email' => 'portal@autovet.com'],
            [
                'name' => 'John Doe (Pet Owner)',
                'password' => Hash::make('password123'),
                'role' => Roles::OWNER->value,
                'status' => 'active',
            ]
        );

        // 2. Create the associated Owner record
        Owner::updateOrCreate(
            ['email' => 'portal@autovet.com'],
            [
                'name' => 'John Doe',
                'user_id' => $user->id,
                'phone' => '1234567890',
                'address' => '123 Pet St',
                'city' => 'Anytown',
                'province' => 'Anyprovince',
                'zip' => '12345'
            ]
        );
    }
}

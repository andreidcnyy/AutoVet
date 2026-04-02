<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Enums\Roles;


class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@autovet.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('password123'),
                'role' => Roles::ADMIN->value,

                'status' => 'active',
            ]
        );
    }
}

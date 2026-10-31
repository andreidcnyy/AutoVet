<?php

namespace Database\Factories;

use App\Models\PortalUser;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<PortalUser>
 */
class PortalUserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'clinic_id' => 1,
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '09'.fake()->numerify('#########'),
            'password' => static::$password ??= Hash::make('password'),
            'status' => 'active',
            'email_verified_at' => now(),
        ];
    }
}

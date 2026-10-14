<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PortalUser>
 */
class PortalUserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'clinic_id'         => 1,
            'name'              => fake()->name(),
            'email'             => fake()->unique()->safeEmail(),
            'phone'             => '09' . fake()->numerify('#########'),
            'password'          => static::$password ??= Hash::make('password'),
            'status'            => 'active',
            'email_verified_at' => now(),
        ];
    }
}

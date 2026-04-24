<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Clinic;

class ClinicSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Clinic::updateOrCreate(
            ['email' => 'contact@petwellness.com'],
            [
                'clinic_name' => 'Pet Wellness Animal Clinic',
                'owner_name' => 'Dr. Jane Doe',
                'contact_number' => '09123456789',
                'address' => '123 Pet Street, Wellness City',
                'status' => 'active',
                'subscription_tier' => 'premium',
            ]
        );
    }
}

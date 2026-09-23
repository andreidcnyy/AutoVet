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
        // The clinic multi-tenancy migration already creates the default clinic
        // that every seeded row points at. Fill in its details rather than
        // inserting a second clinic no data would ever belong to.
        $clinic = Clinic::first();

        $details = [
            'clinic_name' => 'Pet Wellness Animal Clinic',
            'email' => 'contact@petwellness.com',
            'owner_name' => 'Dr. Jane Doe',
            'contact_number' => '09123456789',
            'address' => '123 Pet Street, Wellness City',
            'status' => 'active',
            'subscription_tier' => 'premium',
        ];

        if ($clinic) {
            $clinic->update($details);
            return;
        }

        Clinic::create($details);
    }
}

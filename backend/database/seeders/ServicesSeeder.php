<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Support\Str;

class ServicesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Ensure categories exist in mdm_service_categories
        $categories = [
            'Consultation',
            'Vaccination',
            'Preventive Care',
            'Grooming',
            'Laboratory',
            'Surgery',
            'Imaging',
        ];

        foreach ($categories as $catName) {
            ServiceCategory::updateOrCreate(
                ['name' => $catName],
                ['status' => 'Active']
            );
        }

        // 2. Insert/Update services
        $services = [
            [
                'name' => 'General Consultation / Check-up',
                'category' => 'Consultation',
                'pricing_mode' => 'fixed',
                'price' => 400.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Follow-up Consultation',
                'category' => 'Consultation',
                'pricing_mode' => 'fixed',
                'price' => 350.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Anti-Rabies Vaccine',
                'category' => 'Vaccination',
                'pricing_mode' => 'fixed',
                'price' => 500.00,
                'status' => 'Active',
            ],
            [
                'name' => '5 in 1 Vaccine (Dogs)',
                'category' => 'Vaccination',
                'pricing_mode' => 'fixed',
                'price' => 1000.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Deworming',
                'category' => 'Preventive Care',
                'pricing_mode' => 'size_based', // Weight Based
                'price' => 0.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Tick and Flea Treatment',
                'category' => 'Preventive Care',
                'pricing_mode' => 'size_based', // Weight Based
                'price' => 0.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Tick and Flea Prevention',
                'category' => 'Preventive Care',
                'pricing_mode' => 'size_based', // Weight Based
                'price' => 0.00,
                'status' => 'Active',
            ],
            [
                'name' => '6 in 1 Vaccine (Dogs)',
                'category' => 'Vaccination',
                'pricing_mode' => 'fixed',
                'price' => 1100.00,
                'status' => 'Active',
            ],
            [
                'name' => '4 in 1 Vaccine (Cats)',
                'category' => 'Vaccination',
                'pricing_mode' => 'fixed',
                'price' => 950.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Basic Grooming',
                'category' => 'Grooming',
                'pricing_mode' => 'size_based', // Weight Based
                'price' => 0.00,
                'status' => 'Active',
            ],
            [
                'name' => 'Full Grooming',
                'category' => 'Grooming',
                'pricing_mode' => 'size_based', // Weight Based
                'price' => 0.00,
                'status' => 'Active',
            ],
            [
                'name' => 'General Laboratory Service',
                'category' => 'Laboratory',
                'pricing_mode' => 'fixed',
                'price' => 0.00,
                'status' => 'Active',
            ],
        ];

        foreach ($services as $svc) {
            Service::updateOrCreate(
                ['name' => $svc['name']],
                [
                    'category' => $svc['category'],
                    'pricing_mode' => $svc['pricing_mode'],
                    'price' => $svc['price'],
                    'base_price' => $svc['price'],
                    'status' => $svc['status'],
                    'pricing_type' => ($svc['pricing_mode'] === 'size_based') ? 'tiered' : 'fixed',
                    'measurement_basis' => ($svc['pricing_mode'] === 'size_based') ? 'weight' : 'none',
                    'uuid' => (string) Str::uuid(),
                ]
            );
        }

        $this->command->info('Master services data has been successfully seeded.');
    }
}

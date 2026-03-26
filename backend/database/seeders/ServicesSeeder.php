<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;
use App\Models\ServicePrice;

class ServicesSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Consultation (Fixed)
        Service::updateOrCreate(
            ['name' => 'General Consultation'],
            [
                'description' => 'Standard pet health checkup',
                'price' => 500.00,
                'pricing_mode' => 'fixed',
                'category' => 'Consultation',
                'status' => 'Active'
            ]
        );

        // 2. Vaccination (Fixed)
        Service::updateOrCreate(
            ['name' => 'Vaccination'],
            [
                'description' => 'Standard vaccination shot',
                'price' => 800.00,
                'pricing_mode' => 'fixed',
                'category' => 'Medical',
                'status' => 'Active'
            ]
        );

        // 3. Grooming (Size-based)
        $grooming = Service::updateOrCreate(
            ['name' => 'Full Grooming'],
            [
                'description' => 'Complete bath, hair cut, and nail trimming',
                'price' => 500.00, // Base price for 'Small'
                'pricing_mode' => 'size_based',
                'category' => 'Grooming',
                'status' => 'Active'
            ]
        );

        $groomingPrices = [
            'Small' => 500.00,
            'Medium' => 700.00,
            'Large' => 900.00,
            'Giant' => 1200.00
        ];

        foreach ($groomingPrices as $size => $price) {
            ServicePrice::updateOrCreate(
                ['service_id' => $grooming->id, 'size_class' => $size],
                ['price' => $price]
            );
        }

        // 4. Medicines (Quantity-based)
        Service::updateOrCreate(
            ['name' => 'Deworming'],
            [
                'description' => 'Internal parasite treatment',
                'price' => 250.00,
                'pricing_mode' => 'fixed',
                'category' => 'Medical',
                'status' => 'Active'
            ]
        );
    }
}

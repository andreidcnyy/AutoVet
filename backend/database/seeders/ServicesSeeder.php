<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;
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

        $clinic = \App\Models\Clinic::first();

        foreach ($categories as $catName) {
            ServiceCategory::updateOrCreate(
                ['name' => $catName, 'clinic_id' => $clinic->id],
                ['status' => 'Active', 'clinic_id' => $clinic->id]
            );
        }

        // 2. Insert/Update services.
        //
        // 'pricing_type' must be one of fixed|size_based|weight_based — those are
        // the only values PricingService branches on, and anything else silently
        // falls through to base_price. Weight-based services carry their real
        // prices in 'tiers' below (keyed by pet size category) instead of a flat
        // base_price, so they must not be left at 0.
        $services = [
            [
                'name' => 'General Consultation / Check-up',
                'category' => 'Consultation',
                'pricing_type' => 'fixed',
                'price' => 400.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => 'Follow-up Consultation',
                'category' => 'Consultation',
                'pricing_type' => 'fixed',
                'price' => 350.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => 'Anti-Rabies Vaccine',
                'category' => 'Vaccination',
                'pricing_type' => 'fixed',
                'price' => 500.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => '5 in 1 Vaccine (Dogs)',
                'category' => 'Vaccination',
                'pricing_type' => 'fixed',
                'price' => 1000.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => '6 in 1 Vaccine (Dogs)',
                'category' => 'Vaccination',
                'pricing_type' => 'fixed',
                'price' => 1100.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => '4 in 1 Vaccine (Cats)',
                'category' => 'Vaccination',
                'pricing_type' => 'fixed',
                'price' => 950.00,
                'requires_doctor' => true,
                'status' => 'Active',
            ],
            [
                'name' => 'Basic Grooming',
                'category' => 'Grooming',
                'pricing_type' => 'weight_based',
                'price' => 0.00,
                'requires_doctor' => false,
                'status' => 'Active',
                'tiers' => [
                    'Extra Small' => 350.00,
                    'Small' => 450.00,
                    'Medium' => 600.00,
                    'Large' => 800.00,
                    'Giant' => 1000.00,
                ],
            ],
            [
                'name' => 'Full Grooming',
                'category' => 'Grooming',
                'pricing_type' => 'weight_based',
                'price' => 0.00,
                'requires_doctor' => false,
                'status' => 'Active',
                'tiers' => [
                    'Extra Small' => 550.00,
                    'Small' => 700.00,
                    'Medium' => 900.00,
                    'Large' => 1200.00,
                    'Giant' => 1500.00,
                ],
            ],
            [
                'name' => 'General Laboratory Service',
                'category' => 'Laboratory',
                'pricing_type' => 'fixed',
                'price' => 800.00,
                'requires_doctor' => false,
                'status' => 'Active',
            ],
        ];

        $sizeIds = PetSizeCategory::where('clinic_id', $clinic->id)->pluck('id', 'name');

        foreach ($services as $svc) {
            $isWeightBased = $svc['pricing_type'] === 'weight_based';

            $service = Service::updateOrCreate(
                ['name' => $svc['name'], 'clinic_id' => $clinic->id],
                [
                    'category' => $svc['category'],
                    'pricing_mode' => $isWeightBased ? 'size_based' : 'fixed',
                    'price' => $svc['price'],
                    'base_price' => $svc['price'],
                    'status' => $svc['status'],
                    'requires_doctor' => $svc['requires_doctor'],
                    'pricing_type' => $svc['pricing_type'],
                    'measurement_basis' => $isWeightBased ? 'weight' : 'none',
                    'uuid' => (string) Str::uuid(),
                    'clinic_id' => $clinic->id,
                ]
            );

            // PricingService resolves a weight-based service by mapping the pet's
            // weight to a WeightRange, then looking up a 'size' rule keyed by that
            // range's size category — so the rules are stored per size, not per weight.
            $service->pricingRules()->delete();

            foreach ($svc['tiers'] ?? [] as $sizeName => $price) {
                if (!isset($sizeIds[$sizeName])) {
                    continue;
                }

                $service->pricingRules()->create([
                    'basis_type' => 'size',
                    'reference_id' => $sizeIds[$sizeName],
                    'price' => $price,
                ]);
            }
        }

        $this->command->info('Master services data has been successfully seeded.');
    }
}

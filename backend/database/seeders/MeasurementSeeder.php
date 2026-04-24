<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;
use App\Models\UnitOfMeasure;
use App\Models\WeightRange;
use App\Models\Clinic;

class MeasurementSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();

        // Pet Size Categories
        $sizes = [
            ['name' => 'Small', 'description' => 'Up to 10kg'],
            ['name' => 'Medium', 'description' => '11kg to 25kg'],
            ['name' => 'Large', 'description' => '26kg to 45kg'],
            ['name' => 'Giant', 'description' => 'Over 45kg'],
        ];

        foreach ($sizes as $size) {
            PetSizeCategory::updateOrCreate(['name' => $size['name'], 'clinic_id' => $clinic->id], array_merge($size, ['clinic_id' => $clinic->id]));
        }

        // Weight Ranges
        $weightRanges = [
            ['label' => 'Small', 'min_weight' => 0, 'max_weight' => 5],
            ['label' => 'Medium', 'min_weight' => 6, 'max_weight' => 10],
            ['label' => 'Large', 'min_weight' => 11, 'max_weight' => 20],
            ['label' => 'Giant', 'min_weight' => 21, 'max_weight' => null],
        ];

        foreach ($weightRanges as $range) {
            $category = PetSizeCategory::where('name', $range['label'])->where('clinic_id', $clinic->id)->first();
            WeightRange::updateOrCreate(
                ['label' => $range['label'], 'clinic_id' => $clinic->id],
                array_merge($range, ['size_category_id' => $category?->id, 'clinic_id' => $clinic->id])
            );
        }

        // Units of Measure
        $units = [
            ['name' => 'Kilogram', 'abbreviation' => 'kg'],
            ['name' => 'Pound', 'abbreviation' => 'lbs'],
        ];

        foreach ($units as $unit) {
            UnitOfMeasure::updateOrCreate(['abbreviation' => $unit['abbreviation'], 'clinic_id' => $clinic->id], array_merge($unit, ['clinic_id' => $clinic->id]));
        }
    }
}

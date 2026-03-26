<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;
use App\Models\UnitOfMeasure;
use App\Models\WeightRange;

class MeasurementSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Pet Size Categories
        $sizes = [
            ['name' => 'Small', 'description' => 'Up to 10kg'],
            ['name' => 'Medium', 'description' => '11kg to 25kg'],
            ['name' => 'Large', 'description' => '26kg to 45kg'],
            ['name' => 'Giant', 'description' => 'Over 45kg'],
        ];

        foreach ($sizes as $size) {
            PetSizeCategory::updateOrCreate(['name' => $size['name']], $size);
        }

        // Weight Ranges
        $weightRanges = [
            ['label' => 'Small', 'min_weight' => 0, 'max_weight' => 5],
            ['label' => 'Medium', 'min_weight' => 6, 'max_weight' => 10],
            ['label' => 'Large', 'min_weight' => 11, 'max_weight' => 20],
            ['label' => 'Giant', 'min_weight' => 21, 'max_weight' => null],
        ];

        foreach ($weightRanges as $range) {
            $category = PetSizeCategory::where('name', $range['label'])->first();
            WeightRange::updateOrCreate(
                ['label' => $range['label']],
                array_merge($range, ['size_category_id' => $category?->id])
            );
        }

        // Units of Measure
        $units = [
            ['name' => 'Kilogram', 'abbreviation' => 'kg'],
            ['name' => 'Pound', 'abbreviation' => 'lbs'],
        ];

        foreach ($units as $unit) {
            UnitOfMeasure::updateOrCreate(['abbreviation' => $unit['abbreviation']], $unit);
        }
    }
}

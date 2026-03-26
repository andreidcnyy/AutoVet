<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;
use App\Models\UnitOfMeasure;

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

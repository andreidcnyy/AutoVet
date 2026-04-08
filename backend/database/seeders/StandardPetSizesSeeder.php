<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PetSizeCategory;

class StandardPetSizesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $standardSizes = [
            [
                'name' => 'Extra Small',
                'sort_order' => 1,
                'status' => 'Active',
                'description' => 'Very small pets (e.g. small birds, hamsters)'
            ],
            [
                'name' => 'Small',
                'sort_order' => 2,
                'status' => 'Active',
                'description' => 'Small pets (e.g. cats, small dogs)'
            ],
            [
                'name' => 'Medium',
                'sort_order' => 3,
                'status' => 'Active',
                'description' => 'Medium sized pets (e.g. medium dogs)'
            ],
            [
                'name' => 'Large',
                'sort_order' => 4,
                'status' => 'Active',
                'description' => 'Large pets (e.g. large dogs)'
            ],
            [
                'name' => 'Giant',
                'sort_order' => 5,
                'status' => 'Active',
                'description' => 'Extra large/giant breeds'
            ],
        ];

        foreach ($standardSizes as $size) {
            PetSizeCategory::updateOrCreate(['name' => $size['name']], $size);
        }
    }
}

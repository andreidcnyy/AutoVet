<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\InventoryCategory;
use App\Models\ServiceCategory;

class MasterDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Inventory Categories
        $inventoryCategories = [
            ['name' => 'Medications', 'status' => 'Active'],
            ['name' => 'Consumables', 'status' => 'Active'],
            ['name' => 'Equipment', 'status' => 'Active'],
            ['name' => 'Lab Supplies', 'status' => 'Active'],
        ];

        foreach ($inventoryCategories as $category) {
            InventoryCategory::updateOrCreate(['name' => $category['name']], $category);
        }

        // Service Categories
        $serviceCategories = [
            ['name' => 'Consultations', 'status' => 'Active'],
            ['name' => 'Surgery', 'status' => 'Active'],
            ['name' => 'Laboratory', 'status' => 'Active'],
            ['name' => 'Imaging', 'status' => 'Active'],
            ['name' => 'Vaccination', 'status' => 'Active'],
            ['name' => 'Grooming', 'status' => 'Active'],
        ];

        foreach ($serviceCategories as $category) {
            ServiceCategory::updateOrCreate(['name' => $category['name']], $category);
        }
    }
}

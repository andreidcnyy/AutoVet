<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $this->call([
            MasterDataSeeder::class,
            MeasurementSeeder::class,
            StandardBreedsSeeder::class,
            InventoryListSeeder::class,
            SettingSeeder::class,
            NotificationTemplateSeeder::class,
            AdminUserSeeder::class,
            PHClinicAISeeder::class, // Run before PortalUserSeeder because it truncates owners
            PortalUserSeeder::class,
            ServicesSeeder::class,
            ServiceForecastDatasetSeeder::class,
            DashboardAIForecastSeeder::class,
        ]);
    }
}

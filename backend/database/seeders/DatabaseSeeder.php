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
            ClinicSeeder::class,
            MasterDataSeeder::class,
            MeasurementSeeder::class,
            StandardPetSizesSeeder::class, // Added
            StandardBreedsSeeder::class,
            InventoryListSeeder::class,
            SettingSeeder::class,
            NotificationTemplateSeeder::class,
            AdminUserSeeder::class,
            PHClinicAISeeder::class,
            PortalUserSeeder::class,
            ServicesSeeder::class,
            DashboardAIForecastSeeder::class,
            PatientPetSeeder::class,
            BulkProductionMockSeeder::class, // Added for 50+ records
        ]);
    }
}

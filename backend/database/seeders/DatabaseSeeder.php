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
            // Early: later seeders need a veterinarian to assign visits to.
            ClinicStaffSeeder::class,
            PortalUserSeeder::class,
            ServicesSeeder::class,
            DashboardAIForecastSeeder::class,
            PatientPetSeeder::class,
            BulkProductionMockSeeder::class,
            AnalyticsMockSeeder::class,
            // Last: builds the visible clinic (clients, visits, records, billing)
            // on top of the reference and mock data the seeders above provide.
            ClinicOperationsSeeder::class,
        ]);

        // Several seeders insert in bulk with DB::table()->insert(), which skips
        // the Eloquent event that fills uuid and last_modified_locally_at. Fill
        // them afterwards so a freshly seeded database has no empty sync ids.
        $this->command->call('db:backfill-sync-uuids');
    }
}

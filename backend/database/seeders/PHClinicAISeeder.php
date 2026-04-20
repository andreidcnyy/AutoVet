<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Inventory;
use App\Models\InventoryCategory;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Appointment;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PHClinicAISeeder extends Seeder
{
    public function run(): void
    {
        // Disable foreign key checks temporarily (for idempotency of updateOrCreate)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('invoice_items')->truncate();
        DB::table('invoices')->truncate();
        DB::table('appointments')->truncate();
        DB::table('pets')->truncate();
        DB::table('patients')->truncate();
        DB::table('owners')->truncate();
        DB::table('notifications')->truncate();
        DB::table('inventory_usage_history')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 1. Setup Master Data
        $canine = Species::updateOrCreate(['name' => 'Canine'], ['status' => 'Active']);
        $feline = Species::updateOrCreate(['name' => 'Feline'], ['status' => 'Active']);
        $medCategory = InventoryCategory::updateOrCreate(['name' => 'Medications'], ['status' => 'Active']);

        $golden = Breed::updateOrCreate(['name' => 'Golden Retriever', 'species_id' => $canine->id]);
        $persian = Breed::updateOrCreate(['name' => 'Persian Cat', 'species_id' => $feline->id]);

        // Core Vaccines for AI Dataset (INV-001 to INV-005)
        $dhppi = Inventory::where('code', 'INV-001')->first();
        $rabies = Inventory::where('code', 'INV-002')->first();
        $l4 = Inventory::where('code', 'INV-003')->first();
        $kc = Inventory::where('code', 'INV-004')->first();
        $tricat = Inventory::where('code', 'INV-005')->first();
        $vaccine = Inventory::where('code', 'VAC-PARVO-AI')->first(); // Legacy AI seeder vaccine

        if (!$dhppi) {
            $this->command->error('Core vaccine DHPPI (INV-001) not found. Please ensure InventoryListSeeder has run correctly.');
            return;
        }

        // Create a pool of all available vaccines
        $allVacs = array_filter([$dhppi, $rabies, $l4, $kc, $tricat, $vaccine]);

        if (empty($allVacs)) {
             $this->command->error('No vaccine inventory items found to seed historical data. Please run InventoryListSeeder.');
             return;
        }

        // 2. Create pool of owners and pets
        $owners = [];
        // Add specific portal user owner to the pool
        $portalOwner = Owner::updateOrCreate(
            ['email' => 'portal@autovet.com'],
            [
                'name' => 'John Doe',
                'phone' => '1234567890',
                'address' => '123 Pet St',
                'city' => 'Anytown',
                'province' => 'Anyprovince',
                'zip' => '12345'
            ]
        );
        $owners[] = $portalOwner;

        for ($i = 1; $i <= 19; $i++) {
            $owners[] = Owner::create([
                'name' => "PH Client {$i}",
                'email' => "client{$i}@example.ph",
                'phone' => "091700000" . str_pad($i, 2, '0', STR_PAD_LEFT),
                'address' => "Metro Manila, Philippines"
            ]);
        }

        $pets = [];
        foreach ($owners as $index => $owner) {
            $isDog = $index % 2 == 0;
            $pet = Pet::create([
                'name' => ($isDog ? "Bantay " : "Miming ") . ($index + 1),
                'owner_id' => $owner->id,
                'species_id' => $isDog ? $canine->id : $feline->id,
                'breed_id' => $isDog ? $golden->id : $persian->id,
                'date_of_birth' => Carbon::now()->subYears(rand(1, 8)),
                'weight' => rand(3, 25),
                'weight_unit' => 'kg',
                'sex' => $index % 3 == 0 ? 'Female' : 'Male',
                'status' => 'Active'
            ]);
            
            // Sync to legacy patients table
            DB::table('patients')->insert([
                'id' => $pet->id,
                'name' => $pet->name,
                'species' => $isDog ? 'Canine' : 'Feline',
                'owner_name' => $owner->name,
                'owner_email' => $owner->email,
                'status' => 'Healthy',
                'created_at' => now(),
                'updated_at' => now()
            ]);
            
            $pets[] = $pet;
        }

        // 3. Generate 2 Years of Historical Data + 1 Month Future
        $startDate = Carbon::now()->subYears(2)->startOfMonth();
        $endDate = Carbon::now()->addMonth()->endOfMonth();
        
        $this->command->info("Seeding PH AI data from {$startDate->toDateString()} to {$endDate->toDateString()}...");

        $currentDate = $startDate->copy();
        while ($currentDate <= $endDate) {
            $month = $currentDate->month;
            $dayOfWeek = $currentDate->dayOfWeek; // 0=Sun, 6=Sat

            // Seasonal Multipliers
            $seasonMult = 1.0;
            if (in_array($month, [3, 4, 5])) $seasonMult = 1.3; // Summer
            if (in_array($month, [6, 7, 8])) $seasonMult = 1.4; // Rainy
            if ($month == 12) $seasonMult = 1.5; // Christmas

            // Holiday Multipliers
            $holidayMult = 1.0;
            if ($month == 4 && $currentDate->day >= 10 && $currentDate->day <= 17) $holidayMult = 0.2; // Holy Week
            if ($month == 11 && in_array($currentDate->day, [1, 2])) $holidayMult = 0.1; // All Saints
            if (($month == 12 && in_array($currentDate->day, [24, 25, 30, 31])) || ($month == 1 && $currentDate->day == 1)) $holidayMult = 0.1;

            // Weekly Multipliers
            $weekMult = (in_array($dayOfWeek, [0, 6])) ? 1.4 : 1.0; // Sat/Sun busy in PH

            $baseVisits = 2;
            $dailyVisits = (int)($baseVisits * $seasonMult * $holidayMult * $weekMult + rand(-1, 1));
            $dailyVisits = max(0, $dailyVisits);

            for ($v = 0; $v < $dailyVisits; $v++) {
                $pet = $pets[array_rand($pets)];
                
                if ($currentDate <= Carbon::now()) {
                    // Create Past Invoice
                    $total = 650 + rand(-250, 550);
                    $invoiceId = DB::table('invoices')->insertGetId([
                        'invoice_number' => 'AI-' . strtoupper(Str::random(8)),
                        'pet_id' => $pet->id,
                        'status' => 'Paid',
                        'total' => $total,
                        'subtotal' => $total,
                        'created_at' => $currentDate->copy()->addHours(rand(8, 17)),
                        'updated_at' => $currentDate->copy(),
                        'uuid' => (string) Str::uuid(),
                        'sync_status' => 'local_only',
                        'stock_deducted' => true
                    ]);

                    // Add a random vaccine from the core set
                    if (rand(1, 10) <= 4) {
                        $targetVac = $allVacs[array_rand($allVacs)];
                        $qty = 1;

                        // Find matching service for forecasting
                        $serviceName = 'Vaccination';
                        if (str_contains($targetVac->item_name, 'Rabies')) $serviceName = 'Anti-Rabies Vaccine';
                        elseif (str_contains($targetVac->item_name, '5-in-1') || str_contains($targetVac->item_name, 'DHPPI')) $serviceName = '5 in 1 Vaccine (Dogs)';
                        
                        $service = \App\Models\Service::where('name', 'like', "%{$serviceName}%")->first();

                        $itemId = DB::table('invoice_items')->insertGetId([
                            'invoice_id' => $invoiceId,
                            'name' => $targetVac->item_name,
                            'item_type' => 'inventory',
                            'inventory_id' => $targetVac->id,
                            'service_id' => $service ? $service->id : null, // LINK TO SERVICE FOR FORECAST
                            'qty' => $qty,
                            'unit_price' => $targetVac->selling_price,
                            'amount' => $targetVac->selling_price,
                            'created_at' => $currentDate->copy(),
                            'updated_at' => $currentDate->copy(),
                            'uuid' => (string) Str::uuid(),
                            'sync_status' => 'local_only'
                        ]);
                        
                        // Populate the InventoryUsageHistory table directly
                        DB::table('inventory_usage_history')->insert([
                            'inventory_id' => $targetVac->id,
                            'invoice_id'   => $invoiceId,
                            'invoice_item_id' => $itemId,
                            'quantity_used' => $qty,
                            'usage_date'   => $currentDate->copy()->toDateString(),
                            'source_type'  => 'retail_sale',
                            'unit_price'   => $targetVac->selling_price,
                            'created_at'   => $currentDate->copy(),
                            'updated_at'   => $currentDate->copy(),
                        ]);

                        // Deduct from stock
                        $targetVac->decrement('stock_level', $qty);
                    }
                }

                // Create Appointment (Historical and Future)
                Appointment::create([
                    'pet_id' => $pet->id,
                    'title' => 'Visit for ' . $pet->name,
                    'date' => $currentDate->toDateString(),
                    'time' => rand(8, 16) . ':00',
                    'status' => $currentDate < Carbon::now() ? 'Completed' : 'Scheduled',
                    'created_at' => $currentDate->copy()->subDays(rand(1, 7))
                ]);
            }

            $currentDate->addDay();
        }

        // Finalize notification
        Notification::create([
            'title' => 'PH AI Model Trained',
            'message' => 'Dashboard AI has been populated with 2 years of Philippine-specific trends (Summer, Rainy Season, and Holidays).',
            'type' => 'System',
            'created_at' => Carbon::now()
        ]);
    }
}

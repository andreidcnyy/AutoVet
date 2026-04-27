<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Service;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Appointment;
use App\Models\Clinic;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class ServiceForecastDatasetSeeder extends Seeder
{
    public function run(): void
    {
        $clinics = Clinic::all();
        if ($clinics->isEmpty()) {
            $this->command->error("No clinics found. Please seed clinics first.");
            return;
        }

        $dataFiles = [
            'autovet_daily_services_2024.csv', 
            'autovet_daily_services_2025.csv', 
            'autovet_daily_services_jan_apr_2026_full.csv'
        ];

        foreach ($clinics as $clinic) {
            $this->command->info("Seeding data for clinic: {$clinic->clinic_name} (ID: {$clinic->id})");
            
            $seedOwner = Owner::updateOrCreate(
                ['email' => "dataset.seeder.clinic{$clinic->id}@autovet.ai", 'clinic_id' => $clinic->id],
                ['name' => 'AI Training Record', 'phone' => '09123456789', 'address' => 'AutoVet AI Labs', 'city' => 'Manila', 'province' => 'Metro Manila', 'zip' => '1000']
            );
            
            $seedPet = Pet::updateOrCreate(
                ['name' => 'DataModel-Pet', 'owner_id' => $seedOwner->id, 'clinic_id' => $clinic->id],
                [
                    'species_id' => Species::first()->id ?? 1,
                    'breed_id' => Breed::first()->id ?? 1,
                    'sex' => 'Male',
                    'date_of_birth' => '2020-01-01',
                    'weight' => 10.0
                ]
            );

            foreach ($dataFiles as $fileName) {
                $filePath = storage_path("datasets/{$fileName}");
                if (!file_exists($filePath)) {
                    $this->command->warn("File not found: {$filePath}");
                    continue;
                }

                $handle = fopen($filePath, 'r');
                fgetcsv($handle); // skip header
                $invoicesBatch = []; $apptsBatch = []; $count = 0;

                while (($row = fgetcsv($handle)) !== false) {
                    if (count($row) < 6) continue;
                    [$dateStr, $name, $category, $quantity, $price, $revenue] = $row;
                    
                    // Robust Date Parsing
                    try {
                        // Try D/MM/YY first for 2025/2026 files
                        if (strpos($dateStr, '/') !== false) {
                            $timestamp = Carbon::createFromFormat('j/m/y', $dateStr);
                        } else {
                            $timestamp = Carbon::parse($dateStr);
                        }
                    } catch (\Exception $e) {
                        try {
                             $timestamp = Carbon::parse($dateStr);
                        } catch (\Exception $e2) {
                            continue; // Skip unparseable dates
                        }
                    }

                    $service = Service::where('name', $name)->where('clinic_id', $clinic->id)->first();
                    if (!$service) {
                        $service = Service::create([
                            'name' => $name, 
                            'category' => $category, 
                            'base_price' => (float)$price, 
                            'uuid' => (string) Str::uuid(), 
                            'clinic_id' => $clinic->id
                        ]);
                    }

                    $invoiceNum = 'SEED-' . Str::upper(Str::random(4)) . '-' . (100000 + $count) . '-' . $clinic->id;

                    $invoicesBatch[] = [
                        'invoice' => [
                            'invoice_number' => $invoiceNum, 
                            'pet_id' => $seedPet->id, 
                            'status' => 'Paid', // Using 'Paid' for maximum visibility
                            'subtotal' => (float)$revenue, 
                            'total' => (float)$revenue, 
                            'amount_paid' => (float)$revenue, 
                            'clinic_id' => $clinic->id, 
                            'created_at' => $timestamp, 
                            'updated_at' => $timestamp, 
                            'uuid' => (string) Str::uuid()
                        ], 
                        'item' => [
                            'service_id' => $service->id, 
                            'name' => $service->name, 
                            'qty' => $quantity, 
                            'unit_price' => $price, 
                            'amount' => $revenue
                        ]
                    ];
                    
                    $apptsBatch[] = [
                        'uuid' => (string) Str::uuid(), 
                        'pet_id' => $seedPet->id, 
                        'service_id' => $service->id, 
                        'title' => $service->name, 
                        'date' => $timestamp->toDateString(), 
                        'time' => '09:00', 
                        'status' => $timestamp->isPast() ? 'completed' : 'approved', 
                        'category' => $service->category, 
                        'notes' => 'Seeded historical visit.', 
                        'clinic_id' => $clinic->id, 
                        'created_at' => $timestamp, 
                        'updated_at' => $timestamp
                    ];
                    
                    $count++;

                    if ($count % 200 === 0) {
                        $this->flushBatches($invoicesBatch, $apptsBatch);
                        $invoicesBatch = []; $apptsBatch = [];
                    }
                }
                if (!empty($invoicesBatch)) $this->flushBatches($invoicesBatch, $apptsBatch);
                fclose($handle);
            }
            
            // Clear cache for this clinic
            Cache::forget("service_forecast_v8_clinic_{$clinic->id}");
        }
        
        $this->command->info("Seeding complete. All months in 2024, 2025, and 2026 (partial) should be populated.");
    }

    private function flushBatches($invoices, $appts)
    {
        DB::transaction(function () use ($invoices, $appts) {
            DB::table('appointments')->insert($appts);
            foreach ($invoices as $batchItem) {
                $id = DB::table('invoices')->insertGetId($batchItem['invoice']);
                DB::table('invoice_items')->insert(array_merge($batchItem['item'], [
                    'invoice_id' => $id, 
                    'item_type' => 'service', 
                    'created_at' => $batchItem['invoice']['created_at'], 
                    'updated_at' => $batchItem['invoice']['updated_at'], 
                    'uuid' => (string) Str::uuid()
                ]));
            }
        });
    }
}

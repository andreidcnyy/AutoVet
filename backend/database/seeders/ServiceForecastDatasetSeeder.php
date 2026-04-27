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
            $this->command->error("No clinics found.");
            return;
        }

        $seederEmail = 'dataset.seeder@autovet.ai';

        // 1. CLEANUP: Remove all previous seeded records to stop unwanted years (2027+)
        $this->command->info("Cleaning up old mock data...");
        $oldOwners = Owner::where('email', 'LIKE', 'dataset.seeder%')->get();
        foreach ($oldOwners as $o) {
            $petIds = Pet::where('owner_id', $o->id)->pluck('id');
            $invoiceIds = Invoice::whereIn('pet_id', $petIds)->pluck('id');
            
            DB::table('invoice_items')->whereIn('invoice_id', $invoiceIds)->delete();
            DB::table('invoices')->whereIn('id', $invoiceIds)->delete();
            DB::table('appointments')->whereIn('pet_id', $petIds)->delete();
            DB::table('pets')->whereIn('id', $petIds)->delete();
            $o->delete();
        }

        $dataFiles = [
            'autovet_daily_services_2024.csv', 
            'autovet_daily_services_2025.csv', 
            'autovet_daily_services_jan_apr_2026_full.csv'
        ];

        foreach ($clinics as $clinic) {
            $this->command->info("Seeding 2023-2026 for clinic: {$clinic->clinic_name}");
            
            $seedOwner = Owner::create([
                'email' => "dataset.seeder.clinic{$clinic->id}@autovet.ai", 
                'clinic_id' => $clinic->id,
                'name' => 'AI Training Record', 
                'phone' => '09123456789', 
                'address' => 'AutoVet AI Labs'
            ]);
            
            $seedPet = Pet::create([
                'name' => 'DataModel-Pet', 
                'owner_id' => $seedOwner->id, 
                'clinic_id' => $clinic->id,
                'species_id' => Species::first()->id ?? 1,
                'breed_id' => Breed::first()->id ?? 1,
                'sex' => 'Male',
                'date_of_birth' => '2020-01-01',
                'weight' => 10.0
            ]);

            foreach ($dataFiles as $fileName) {
                $filePath = storage_path("datasets/{$fileName}");
                if (!file_exists($filePath)) continue;

                $handle = fopen($filePath, 'r');
                fgetcsv($handle); 
                $invoicesBatch = []; $apptsBatch = []; $count = 0;

                while (($row = fgetcsv($handle)) !== false) {
                    if (count($row) < 6) continue;
                    [$dateStr, $name, $category, $quantity, $price, $revenue] = $row;
                    
                    try {
                        if (strpos($dateStr, '/') !== false) {
                            $timestamp = Carbon::createFromFormat('n/j/y', $dateStr)->startOfDay();
                        } else {
                            $timestamp = Carbon::parse($dateStr)->startOfDay();
                        }

                        // STRICT LIMIT: Only 2023 to 2026
                        if ($timestamp->year < 2023 || $timestamp->year > 2026) {
                            continue;
                        }
                    } catch (\Exception $e) {
                        continue; 
                    }

                    $service = Service::where('name', $name)->where('clinic_id', $clinic->id)->first();
                    if (!$service) {
                        $service = Service::create([
                            'name' => $name, 'category' => $category, 'base_price' => (float)$price, 
                            'uuid' => (string) Str::uuid(), 'clinic_id' => $clinic->id
                        ]);
                    }

                    $invoiceNum = 'S-' . $clinic->id . '-' . Str::upper(Str::random(3)) . '-' . (200000 + $count);

                    $invoicesBatch[] = [
                        'invoice' => [
                            'invoice_number' => $invoiceNum, 'pet_id' => $seedPet->id, 'status' => 'Paid', 
                            'subtotal' => (float)$revenue, 'total' => (float)$revenue, 'amount_paid' => (float)$revenue, 
                            'clinic_id' => $clinic->id, 'created_at' => $timestamp, 'updated_at' => $timestamp, 'uuid' => (string) Str::uuid()
                        ], 
                        'item' => [
                            'service_id' => $service->id, 'name' => $service->name, 'qty' => $quantity, 'unit_price' => $price, 'amount' => $revenue
                        ]
                    ];
                    
                    $apptsBatch[] = [
                        'uuid' => (string) Str::uuid(), 'pet_id' => $seedPet->id, 'service_id' => $service->id, 
                        'title' => $service->name, 'date' => $timestamp->toDateString(), 'time' => '09:00', 
                        'status' => $timestamp->isPast() ? 'completed' : 'approved', 
                        'category' => $service->category, 'clinic_id' => $clinic->id, 
                        'created_at' => $timestamp, 'updated_at' => $timestamp
                    ];
                    
                    $count++;
                    if ($count % 500 === 0) {
                        $this->flushBatches($invoicesBatch, $apptsBatch);
                        $invoicesBatch = []; $apptsBatch = [];
                    }
                }
                if (!empty($invoicesBatch)) $this->flushBatches($invoicesBatch, $apptsBatch);
                fclose($handle);
            }
            Cache::forget("service_forecast_v8_clinic_{$clinic->id}");
        }
        $this->command->info("Seeding complete. Strictly 2023-2026.");
    }

    private function flushBatches($invoices, $appts)
    {
        DB::transaction(function () use ($invoices, $appts) {
            DB::table('appointments')->insert($appts);
            foreach ($invoices as $batchItem) {
                $id = DB::table('invoices')->insertGetId($batchItem['invoice']);
                DB::table('invoice_items')->insert(array_merge($batchItem['item'], [
                    'invoice_id' => $id, 'item_type' => 'service', 
                    'created_at' => $batchItem['invoice']['created_at'], 
                    'updated_at' => $batchItem['invoice']['updated_at'], 'uuid' => (string) Str::uuid()
                ]));
            }
        });
    }
}

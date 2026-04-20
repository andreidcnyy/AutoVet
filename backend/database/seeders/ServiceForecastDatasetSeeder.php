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
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ServiceForecastDatasetSeeder extends Seeder
{
    public function run(): void
    {
        $dataFiles = [
            'autovet_daily_services_2024.csv',
            'autovet_daily_services_2025.csv',
            'autovet_daily_services_jan_apr_2026_full.csv',
        ];

        // Ensure we have a base pet/owner for the seeded data
        $seedOwner = Owner::firstOrCreate(
            ['email' => 'dataset.seeder@autovet.ai'],
            [
                'name' => 'AI Training Record',
                'phone' => '09123456789',
                'address' => 'AutoVet AI Labs',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip' => '1000',
            ]
        );

        $seedPet = Pet::firstOrCreate(
            ['name' => 'DataModel-Pet', 'owner_id' => $seedOwner->id],
            [
                'species_id' => Species::first()->id ?? 1,
                'breed_id' => Breed::first()->id ?? 1,
                'sex' => 'Male',
                'date_of_birth' => '2020-01-01',
                'weight' => 10.0,
            ]
        );

        foreach ($dataFiles as $fileName) {
            $filePath = storage_path("datasets/{$fileName}");
            if (!file_exists($filePath)) {
                $this->command->warn("File missing: {$filePath}");
                continue;
            }

            $handle = fopen($filePath, 'r');
            $header = fgetcsv($handle); // Skip header

            $invoicesBatch = [];
            $itemsBatch = [];
            $apptsBatch = [];
            $count = 0;

            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) < 6) continue;

                [$date, $name, $category, $quantity, $price, $revenue] = $row;
                $service = Service::where('name', $name)->first();
                if (!$service) {
                    $service = Service::create([
                        'name' => $name,
                        'category' => $category,
                        'base_price' => (float)$price,
                        'uuid' => (string) Str::uuid(),
                    ]);
                }

                $invoiceId = (string) Str::uuid(); // Use UUID as temp ID if needed or just use DB increment
                $timestamp = Carbon::parse($date);
                
                // For bulk, we'll use DB::table to avoid model overhead
                // We generate a unique number for each invoice
                $invoiceNum = 'SEED-' . Str::upper(Str::random(4)) . '-' . (100000 + $count);

                $invoicesBatch[] = [
                    'invoice' => [
                        'invoice_number' => $invoiceNum,
                        'pet_id' => $seedPet->id,
                        'status' => 'Finalized',
                        'subtotal' => (float)$revenue,
                        'total' => (float)$revenue,
                        'amount_paid' => (float)$revenue,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                        'uuid' => (string) Str::uuid(),
                    ],
                    'item' => [
                        'service_id' => $service->id,
                        'name' => $service->name,
                        'qty' => $quantity,
                        'unit_price' => $price,
                        'amount' => $revenue,
                    ]
                ];

                $apptsBatch[] = [
                    'uuid' => (string) Str::uuid(),
                    'pet_id' => $seedPet->id,
                    'service_id' => $service->id,
                    'title' => $service->name,
                    'date' => $timestamp->toDateString(),
                    'time' => '09:00',
                    'status' => $timestamp->isPast() ? 'completed' : 'pending',
                    'category' => $service->category,
                    'notes' => 'Seeded historical visit.',
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];

                $count++;

                if ($count % 500 === 0) {
                    $this->flushBatches($invoicesBatch, $apptsBatch);
                    $invoicesBatch = [];
                    $apptsBatch = [];
                }
            }

            // Final flush
            if (!empty($invoicesBatch)) {
                $this->flushBatches($invoicesBatch, $apptsBatch);
            }

            fclose($handle);
            $this->command->info("Bulk Seeded: {$filePath} ({$count} records)");
        }
    }

    private function flushBatches($invoices, $appts)
    {
        DB::transaction(function () use ($invoices, $appts) {
            // Insert Appointments
            DB::table('appointments')->insert($appts);

            // Insert Invoices and match Items
            foreach ($invoices as $batchItem) {
                $invData = $batchItem['invoice'];
                $itemData = $batchItem['item'];
                
                $id = DB::table('invoices')->insertGetId($invData);
                
                DB::table('invoice_items')->insert([
                    'invoice_id' => $id,
                    'item_type' => 'service',
                    'service_id' => $itemData['service_id'],
                    'name' => $itemData['name'],
                    'qty' => $itemData['qty'],
                    'unit_price' => $itemData['unit_price'],
                    'amount' => $itemData['amount'],
                    'created_at' => $invData['created_at'],
                    'updated_at' => $invData['updated_at'],
                    'uuid' => (string) Str::uuid(),
                ]);
            }
        });
    }
}

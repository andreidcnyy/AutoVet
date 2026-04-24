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

class ServiceForecastDatasetSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        $dataFiles = ['autovet_daily_services_2024.csv', 'autovet_daily_services_2025.csv', 'autovet_daily_services_jan_apr_2026_full.csv'];

        $seedOwner = Owner::updateOrCreate(['email' => 'dataset.seeder@autovet.ai', 'clinic_id' => $clinic->id], ['name' => 'AI Training Record', 'phone' => '09123456789', 'address' => 'AutoVet AI Labs', 'city' => 'Manila', 'province' => 'Metro Manila', 'zip' => '1000', 'clinic_id' => $clinic->id]);
        $seedPet = Pet::updateOrCreate(['name' => 'DataModel-Pet', 'owner_id' => $seedOwner->id, 'clinic_id' => $clinic->id], ['species_id' => Species::where('clinic_id', $clinic->id)->first()->id ?? 1, 'breed_id' => Breed::where('clinic_id', $clinic->id)->first()->id ?? 1, 'sex' => 'Male', 'date_of_birth' => '2020-01-01', 'weight' => 10.0, 'clinic_id' => $clinic->id]);

        foreach ($dataFiles as $fileName) {
            $filePath = storage_path("datasets/{$fileName}");
            if (!file_exists($filePath)) continue;

            $handle = fopen($filePath, 'r');
            fgetcsv($handle);
            $invoicesBatch = []; $apptsBatch = []; $count = 0;

            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) < 6) continue;
                [$date, $name, $category, $quantity, $price, $revenue] = $row;
                $service = Service::where('name', $name)->where('clinic_id', $clinic->id)->first();
                if (!$service) {
                    $service = Service::create(['name' => $name, 'category' => $category, 'base_price' => (float)$price, 'uuid' => (string) Str::uuid(), 'clinic_id' => $clinic->id]);
                }

                $timestamp = Carbon::parse($date);
                $invoiceNum = 'SEED-' . Str::upper(Str::random(4)) . '-' . (100000 + $count);

                $invoicesBatch[] = ['invoice' => ['invoice_number' => $invoiceNum, 'pet_id' => $seedPet->id, 'status' => 'Finalized', 'subtotal' => (float)$revenue, 'total' => (float)$revenue, 'amount_paid' => (float)$revenue, 'clinic_id' => $clinic->id, 'created_at' => $timestamp, 'updated_at' => $timestamp, 'uuid' => (string) Str::uuid()], 'item' => ['service_id' => $service->id, 'name' => $service->name, 'qty' => $quantity, 'unit_price' => $price, 'amount' => $revenue, 'clinic_id' => $clinic->id]];
                $apptsBatch[] = ['uuid' => (string) Str::uuid(), 'pet_id' => $seedPet->id, 'service_id' => $service->id, 'title' => $service->name, 'date' => $timestamp->toDateString(), 'time' => '09:00', 'status' => $timestamp->isPast() ? 'completed' : 'pending', 'category' => $service->category, 'notes' => 'Seeded historical visit.', 'clinic_id' => $clinic->id, 'created_at' => $timestamp, 'updated_at' => $timestamp];
                $count++;

                if ($count % 500 === 0) {
                    $this->flushBatches($invoicesBatch, $apptsBatch);
                    $invoicesBatch = []; $apptsBatch = [];
                }
            }
            if (!empty($invoicesBatch)) $this->flushBatches($invoicesBatch, $apptsBatch);
            fclose($handle);
        }
    }

    private function flushBatches($invoices, $appts)
    {
        DB::transaction(function () use ($invoices, $appts) {
            DB::table('appointments')->insert($appts);
            foreach ($invoices as $batchItem) {
                $id = DB::table('invoices')->insertGetId($batchItem['invoice']);
                DB::table('invoice_items')->insert(array_merge($batchItem['item'], ['invoice_id' => $id, 'item_type' => 'service', 'created_at' => $batchItem['invoice']['created_at'], 'updated_at' => $batchItem['invoice']['updated_at'], 'uuid' => (string) Str::uuid()]));
            }
        });
    }
}

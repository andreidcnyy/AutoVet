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
use App\Models\Clinic;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DashboardMockSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();

        // Disable foreign key checks for clean seeding
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('invoice_items')->truncate();
        DB::table('invoices')->truncate();
        DB::table('appointments')->truncate();
        DB::table('pets')->truncate();
        DB::table('patients')->truncate();
        DB::table('owners')->truncate();
        DB::table('notifications')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 1. Species & Breeds
        $canine = Species::updateOrCreate(['name' => 'Canine', 'clinic_id' => $clinic->id], ['status' => 'Active', 'clinic_id' => $clinic->id]);
        $feline = Species::updateOrCreate(['name' => 'Feline', 'clinic_id' => $clinic->id], ['status' => 'Active', 'clinic_id' => $clinic->id]);

        Breed::updateOrCreate(['name' => 'Golden Retriever', 'species_id' => $canine->id, 'clinic_id' => $clinic->id], ['clinic_id' => $clinic->id]);
        Breed::updateOrCreate(['name' => 'Persian Cat', 'species_id' => $feline->id, 'clinic_id' => $clinic->id], ['clinic_id' => $clinic->id]);

        // 2. Owners
        $owners = [];
        for ($i = 1; $i <= 5; $i++) {
            $owners[] = Owner::create([
                'name' => "Mock Owner {$i}",
                'email' => "owner{$i}@example.com",
                'phone' => "0912345678{$i}",
                'address' => "Quezon City, PH",
                'city' => 'Quezon City',
                'province' => 'Metro Manila',
                'zip' => '1100',
                'clinic_id' => $clinic->id,
            ]);
        }

        // 3. Pets & Patients (Populate both to satisfy inconsistent FKs)
        $pets = [];
        foreach ($owners as $index => $owner) {
            $speciesName = ($index % 2 == 0) ? 'Canine' : 'Feline';
            $speciesId = ($index % 2 == 0) ? $canine->id : $feline->id;
            
            $pet = Pet::create([
                'name' => "Pet of {$owner->name}",
                'owner_id' => $owner->id,
                'species_id' => $speciesId,
                'date_of_birth' => Carbon::now()->subYears(rand(1, 5)),
                'weight' => rand(5, 20),
                'weight_unit' => 'kg',
                'status' => 'Active',
                'sex' => (rand(0, 1) == 0) ? 'Male' : 'Female',
                'clinic_id' => $clinic->id,
            ]);

            // Sync to patients table
            DB::table('patients')->insert([
                'id' => $pet->id,
                'name' => $pet->name,
                'species' => $speciesName,
                'owner_name' => $owner->name,
                'owner_email' => $owner->email,
                'status' => 'Healthy',
                'clinic_id' => $clinic->id,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $pets[] = $pet;
        }

        // 4. Inventory
        $medCategory = InventoryCategory::where('name', 'Medications')->where('clinic_id', $clinic->id)->first();
        $meds = ['Paracetamol', 'Antibiotics', 'Vitamins', 'Anti-flea'];
        foreach ($meds as $index => $med) {
            Inventory::updateOrCreate(
                ['item_name' => $med, 'clinic_id' => $clinic->id],
                [
                    'inventory_category_id' => $medCategory->id ?? 1,
                    'sku' => 'MED-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT),
                    'code' => 'MED-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT),
                    'stock_level' => rand(5, 50),
                    'min_stock_level' => 10,
                    'price' => rand(50, 200),
                    'selling_price' => rand(250, 500),
                    'status' => 'Active',
                    'is_billable' => true,
                    'clinic_id' => $clinic->id,
                ]
            );
        }

        // 5. Appointments
        foreach ($pets as $pet) {
            Appointment::create([
                'pet_id' => $pet->id,
                'title' => 'General Checkup for ' . $pet->name,
                'date' => Carbon::now()->addDays(rand(1, 10))->toDateString(),
                'time' => '10:00 AM',
                'status' => 'Scheduled',
                'clinic_id' => $clinic->id,
            ]);
        }

        // 6. Invoices
        $inventoryItems = Inventory::where('clinic_id', $clinic->id)->get();
        for ($m = 5; $m >= 0; $m--) {
            $date = Carbon::now()->subMonths($m);
            for ($i = 0; $i < 3; $i++) {
                $pet = $pets[rand(0, count($pets) - 1)];
                
                $total = rand(500, 2000);
                $invoiceId = DB::table('invoices')->insertGetId([
                    'invoice_number' => 'INV-' . strtoupper(Str::random(8)),
                    'pet_id' => $pet->id,
                    'status' => 'Paid',
                    'total' => $total,
                    'subtotal' => $total,
                    'clinic_id' => $clinic->id,
                    'created_at' => $date->copy()->subDays(rand(1, 25)),
                    'updated_at' => $date->copy()->subDays(rand(1, 25)),
                    'uuid' => (string) Str::uuid(),
                    'sync_status' => 'local_only',
                    'stock_deducted' => true
                ]);

                // Service item
                $service = \App\Models\Service::where('category', 'Consultation')->where('clinic_id', $clinic->id)->first();
                DB::table('invoice_items')->insert([
                    'invoice_id' => $invoiceId,
                    'name' => 'Consultation',
                    'item_type' => 'service',
                    'service_id' => $service ? $service->id : null,
                    'qty' => 1,
                    'unit_price' => $total * 0.8,
                    'amount' => $total * 0.8,
                    'clinic_id' => $clinic->id,
                    'created_at' => $date->copy()->subDays(rand(1, 25)),
                    'updated_at' => $date->copy()->subDays(rand(1, 25)),
                    'uuid' => (string) Str::uuid(),
                    'sync_status' => 'local_only'
                ]);

                // Inventory item
                $inv = $inventoryItems[rand(0, count($inventoryItems) - 1)];
                $qty = rand(1, 5);
                $itemId = DB::table('invoice_items')->insertGetId([
                    'invoice_id' => $invoiceId,
                    'name' => $inv->item_name,
                    'item_type' => 'inventory',
                    'inventory_id' => $inv->id,
                    'qty' => $qty,
                    'unit_price' => $inv->selling_price,
                    'amount' => $inv->selling_price * 1, // simplified
                    'clinic_id' => $clinic->id,
                    'created_at' => $date->copy()->subDays(rand(1, 25)),
                    'updated_at' => $date->copy()->subDays(rand(1, 25)),
                    'uuid' => (string) Str::uuid(),
                    'sync_status' => 'local_only'
                ]);

                // Populate InventoryUsageHistory
                DB::table('inventory_usage_history')->insert([
                    'inventory_id' => $inv->id,
                    'invoice_id'   => $invoiceId,
                    'invoice_item_id' => $itemId,
                    'quantity_used' => $qty,
                    'usage_date'   => $date->copy()->subDays(rand(1, 25))->toDateString(),
                    'source_type'  => 'retail_sale',
                    'unit_price'   => $inv->selling_price,
                    'clinic_id' => $clinic->id,
                    'created_at' => $date->copy(),
                    'updated_at' => $date->copy(),
                ]);
            }
        }

        // 7. Notifications
        Notification::create([
            'title' => 'Database Connected',
            'message' => 'The Admin Dashboard is now showing live data from the Laravel API.',
            'type' => 'System',
            'clinic_id' => $clinic->id,
            'created_at' => Carbon::now()
        ]);
    }
}

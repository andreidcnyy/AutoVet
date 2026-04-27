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
use App\Models\Admin;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PHClinicAISeeder extends Seeder
{
    public function run(): void
    {
        // 1. Identify the Clinic of admin@autovet.com
        $admin = Admin::where('email', 'admin@autovet.com')->first();
        $clinic = $admin ? $admin->clinic : Clinic::first();
        
        if (!$clinic) {
            $clinic = Clinic::create(['clinic_name' => 'AutoVet Clinic', 'email' => 'admin@autovet.com', 'status' => 'active']);
        }

        // 2. Clear AI related tables for this clinic
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Appointment::where('clinic_id', $clinic->id)->delete();
        Invoice::where('clinic_id', $clinic->id)->delete();
        DB::table('invoice_items')->where('clinic_id', $clinic->id)->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 3. Setup core services for categorization
        $services = Service::where('clinic_id', $clinic->id)->get();
        if ($services->isEmpty()) {
            $this->call(ServicesSeeder::class);
            $services = Service::where('clinic_id', $clinic->id)->get();
        }

        $pets = Pet::where('clinic_id', $clinic->id)->get();
        if ($pets->isEmpty()) {
            $this->call(BulkProductionMockSeeder::class);
            $pets = Pet::where('clinic_id', $clinic->id)->get();
        }

        // 4. Generate 3 Full Years of Historical Data (2023, 2024, 2025)
        $startDate = Carbon::create(2023, 1, 1)->startOfDay();
        $endDate = Carbon::now('Asia/Manila')->addMonths(3)->endOfMonth(); // Seed up to 3 months forecast
        
        $this->command->info("Seeding 3 Years of History (2023-2025) for Clinic: {$clinic->clinic_name}");

        $currentDate = $startDate->copy();
        while ($currentDate <= $endDate) {
            $month = $currentDate->month;
            
            // Philippine Seasonal logic
            $seasonMult = 1.0;
            if (in_array($month, [3, 4, 5])) $seasonMult = 1.3; // Summer peak
            if ($month == 12) $seasonMult = 1.6; // Christmas peak

            // Daily volume logic (2-5 visits per day scaled by season)
            $dailyVisits = (int)(rand(2, 4) * $seasonMult);
            
            for ($v = 0; $v < $dailyVisits; $v++) {
                $pet = $pets->random();
                $svc = $services->random();
                
                // Create Appointment
                Appointment::create([
                    'pet_id' => $pet->id,
                    'service_id' => $svc->id,
                    'title' => $svc->category . ' - ' . $pet->name,
                    'date' => $currentDate->toDateString(),
                    'time' => rand(8, 17) . ':00',
                    'status' => $currentDate->isPast() ? 'Completed' : 'Approved',
                    'clinic_id' => $clinic->id,
                    'created_at' => $currentDate->copy()->subDays(rand(1, 10))
                ]);

                // Create Invoice for Sales AI
                if ($currentDate->isPast()) {
                    $total = $svc->price + rand(100, 500);
                    Invoice::create([
                        'invoice_number' => 'AI-' . strtoupper(Str::random(8)),
                        'pet_id' => $pet->id,
                        'status' => 'Paid',
                        'total' => $total,
                        'subtotal' => $total,
                        'clinic_id' => $clinic->id,
                        'created_at' => $currentDate->copy(),
                        'updated_at' => $currentDate->copy(),
                    ]);
                }
            }

            $currentDate->addDay();
        }

        Notification::create([
            'title' => '3-Year AI Dataset Loaded',
            'message' => 'The dashboard is now trained with 2023, 2024, and 2025 historical data for accurate 3-month forecasting.',
            'type' => 'System',
            'clinic_id' => $clinic->id,
        ]);
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Inventory;
use App\Models\InventoryForecast;
use App\Models\MedicalRecord;
use App\Models\Pet;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardAIForecastSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Clear existing forecasts and medical records to prevent duplicates
        DB::table('inventory_forecasts')->truncate();
        
        // 2. Populate Inventory Forecasts for matched items
        $items = Inventory::whereIn('code', ['INV-001', 'INV-002', 'INV-003', 'INV-004', 'INV-005'])->get();

        foreach ($items as $item) {
            $avgDaily = match($item->code) {
                'INV-001' => 1.5,
                'INV-002' => 0.8,
                'INV-003' => 2.1,
                'INV-004' => 0.5,
                'INV-005' => 1.2,
                default => 1.0,
            };

            $daysLeft = match($item->code) {
                'INV-001' => 5,
                'INV-002' => 45,
                'INV-003' => 8,
                'INV-004' => 120,
                'INV-005' => 3,
                default => 30,
            };

            $status = ($daysLeft < 7) ? 'Critical' : (($daysLeft < 14) ? 'Reorder Soon' : 'Safe');
            $notes = match($status) {
                'Critical' => "Immediate reorder required. Current stock will be depleted in less than a week.",
                'Reorder Soon' => "Stock levels are decreasing. Plan to reorder within the next 10 days.",
                'Safe' => "Stock levels are healthy based on average consumption trends.",
            };

            InventoryForecast::create([
                'inventory_id' => $item->id,
                'predicted_demand' => $avgDaily,
                'average_daily_consumption' => $avgDaily,
                'days_until_stockout' => $daysLeft,
                'predicted_stockout_date' => Carbon::now()->addDays($daysLeft)->toDateString(),
                'suggested_reorder_quantity' => $item->min_stock_level * 3,
                'forecast_status' => $status,
                'generated_at' => now(),
                'model_used' => 'manual_mock_seeder',
                'prediction_source' => 'dataset',
                'trigger_source' => 'manual',
                'notes' => $notes,
                'predicted_daily_sales' => $avgDaily,
                'predicted_weekly_sales' => $avgDaily * 7,
                'predicted_monthly_sales' => $avgDaily * 30,
                'estimated_monthly_revenue' => $avgDaily * 30 * $item->selling_price,
            ]);
        }

        // 3. Populate Medical Records with Follow-up Dates for "Patient Visit Predictions"
        $pets = Pet::all();
        if ($pets->count() > 0) {
            // Some overdue
            for ($i = 0; $i < 3; $i++) {
                $pet = $pets->random();
                MedicalRecord::create([
                    'pet_id' => $pet->id,
                    'vet_id' => 1,
                    'created_at' => Carbon::now()->subMonths(1),
                    'follow_up_date' => Carbon::now()->subDays(rand(1, 10)),
                    'diagnosis' => 'Post-op Checkup',
                    'treatment_plan' => 'Monitor wound healing.',
                    'notes' => 'Owner was notified but hasn\'t scheduled yet.',
                ]);
            }

            // Some upcoming
            for ($i = 0; $i < 5; $i++) {
                $pet = $pets->random();
                MedicalRecord::create([
                    'pet_id' => $pet->id,
                    'vet_id' => 1,
                    'created_at' => Carbon::now()->subDays(15),
                    'follow_up_date' => Carbon::now()->addDays(rand(1, 15)),
                    'diagnosis' => 'Vaccination Follow-up',
                    'treatment_plan' => 'Second dose of 5-in-1.',
                    'notes' => 'Scheduled for next week.',
                ]);
            }
        }
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Appointment;
use App\Models\Pet;
use App\Models\Service;
use App\Models\Admin;
use Carbon\Carbon;
use Illuminate\Support\Str;

class HistoricalServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Initializing Historical Service Seeder (AI Forecast Ready)...');

        // 1. Dynamic Service Resolution
        $servicePool = $this->resolveServices();
        if (empty($servicePool)) {
            $this->command->error('No services found in the database. Please run MasterDataSeeder first.');
            return;
        }

        // 2. Pet Behavior Profiling
        $pets = Pet::all();
        if ($pets->isEmpty()) {
            $this->command->error('No pets found. Please seed pets first.');
            return;
        }
        $petProfiles = $this->generatePetProfiles($pets);

        // 3. Vet Resolution
        $vets = Admin::where('role', 'like', '%vet%')->pluck('id')->toArray();
        if (empty($vets)) {
            $vets = [Admin::first()->id]; // Fallback to first admin
        }

        // 4. Seeding Parameters
        $startDate = Carbon::now()->subMonths(24);
        $totalDays = 730;
        $totalGenerated = 0;
        $stats = [
            'categories' => ['Consultation' => 0, 'Vaccination' => 0, 'Grooming' => 0, 'Laboratory' => 0],
            'status' => ['completed' => 0, 'cancelled' => 0, 'rescheduled' => 0],
            'months' => []
        ];

        $this->command->getOutput()->progressStart($totalDays);

        for ($i = 0; $i < $totalDays; $i++) {
            $currentDate = $startDate->copy()->addDays($i);
            $monthKey = $currentDate->format('Y-m');

            // Apply Seasonality Boosters
            $boost = 1.0;
            $month = $currentDate->month;
            
            // Summer Booster (March-May) - Grooming focused
            if ($month >= 3 && $month <= 5) $boost += 0.3;
            // Holiday Booster (December) - Grooming focused
            if ($month == 12) $boost += 0.4;
            // Rainy Booster (June-Oct) - Consultation focused
            if ($month >= 6 && $month <= 10) $boost += 0.2;

            // Base volume: ~2.7 appointments per day * boost + noise
            $dailyCount = max(0, (int)round(2.7 * $boost + rand(-2, 3)));

            for ($j = 0; $j < $dailyCount; $j++) {
                // Weighted Pet Selection
                $petId = $this->weightedSelectPet($petProfiles);
                $profile = $petProfiles[$petId];

                // Category Selection with Interest Bias
                $category = $this->selectCategoryWithBias($profile, $month);
                
                // Final Service Selection
                $service = $servicePool[$category][array_rand($servicePool[$category])];

                // Status Selection
                $statusRoll = rand(1, 100);
                $status = 'completed';
                if ($statusRoll > 95) $status = 'rescheduled';
                elseif ($statusRoll > 85) $status = 'cancelled';

                Appointment::create([
                    'uuid' => (string) Str::uuid(),
                    'title' => $service['name'],
                    'date' => $currentDate->toDateString(),
                    'time' => sprintf('%02d:00', rand(8, 17)),
                    'category' => $category,
                    'notes' => 'Generated historical record for AI forecasting.',
                    'status' => $status,
                    'pet_id' => $petId,
                    'service_id' => $service['id'],
                    'vet_id' => $vets[array_rand($vets)],
                    'sync_status' => 'synced',
                ]);

                $totalGenerated++;
                $stats['categories'][$category]++;
                $stats['status'][$status]++;
                $stats['months'][$monthKey] = ($stats['months'][$monthKey] ?? 0) + 1;
            }

            $this->command->getOutput()->progressAdvance();
        }

        $this->command->getOutput()->progressFinish();

        // 5. Summary Report
        $this->displaySummary($totalGenerated, $stats);
    }

    private function resolveServices()
    {
        $pool = [];
        $services = Service::all();
        
        foreach ($services as $s) {
            $cat = $s->category;
            // Normalize "Consultations" to "Consultation" etc if needed
            if (Str::startsWith($cat, 'Consultation')) $cat = 'Consultation';
            if (Str::startsWith($cat, 'Vaccination')) $cat = 'Vaccination';
            
            if (in_array($cat, ['Consultation', 'Vaccination', 'Grooming', 'Laboratory'])) {
                $pool[$cat][] = ['id' => $s->id, 'name' => $s->name];
            }
        }
        return $pool;
    }

    private function generatePetProfiles($pets)
    {
        $profiles = [];
        foreach ($pets as $pet) {
            // Frequency: 10% Frequent (6x), 40% Moderate (3x), 50% Rare (1x)
            $freqRoll = rand(1, 100);
            $weight = 1;
            if ($freqRoll <= 10) $weight = 6;
            elseif ($freqRoll <= 50) $weight = 3;

            // Interest: 20% Grooming Fan, 20% Chronic Patient, 60% General
            $intRoll = rand(1, 100);
            $interest = 'General';
            if ($intRoll <= 20) $interest = 'Groomer';
            elseif ($intRoll <= 40) $interest = 'Chronic';

            $profiles[$pet->id] = [
                'id' => $pet->id,
                'weight' => $weight,
                'interest' => $interest
            ];
        }
        return $profiles;
    }

    private function weightedSelectPet($profiles)
    {
        $totalWeight = 0;
        foreach ($profiles as $p) $totalWeight += $p['weight'];
        
        $roll = rand(1, $totalWeight);
        $currentWeight = 0;
        foreach ($profiles as $id => $p) {
            $currentWeight += $p['weight'];
            if ($roll <= $currentWeight) return $id;
        }
        return array_key_first($profiles);
    }

    private function selectCategoryWithBias($profile, $month)
    {
        $biasRange = rand(60, 75);
        $roll = rand(1, 100);

        // Seasonality Overrides for ALL pets
        // (Summer/Holiday Grooming demand spike)
        if (in_array($month, [3, 4, 5, 12]) && rand(1, 100) <= 20) {
            return 'Grooming';
        }

        if ($profile['interest'] === 'Groomer' && $roll <= $biasRange) {
            return 'Grooming';
        }

        if ($profile['interest'] === 'Chronic' && $roll <= $biasRange) {
            return rand(1, 2) == 1 ? 'Consultation' : 'Laboratory';
        }

        // Default Category Distribution
        $defRoll = rand(1, 100);
        if ($defRoll <= 40) return 'Consultation';
        if ($defRoll <= 70) return 'Vaccination';
        if ($defRoll <= 90) return 'Grooming';
        return 'Laboratory';
    }

    private function displaySummary($total, $stats)
    {
        $this->command->info("\n--- SEEDING COMPLETE ---");
        $this->command->info("Total Records Generated: " . number_format($total));
        
        $this->command->info("\nBY CATEGORY:");
        foreach ($stats['categories'] as $cat => $count) {
            $this->command->line("- $cat: $count (" . round(($count/$total)*100) . "%)");
        }

        $this->command->info("\nBY STATUS:");
        foreach ($stats['status'] as $status => $count) {
            $this->command->line("- $status: $count (" . round(($count/$total)*100) . "%)");
        }
    }
}

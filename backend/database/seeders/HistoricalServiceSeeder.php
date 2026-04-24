<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Appointment;
use App\Models\Pet;
use App\Models\Service;
use App\Models\Admin;
use App\Models\Clinic;
use Carbon\Carbon;
use Illuminate\Support\Str;

class HistoricalServiceSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        $this->command->info('Initializing Historical Service Seeder (AI Forecast Ready)...');

        $servicePool = $this->resolveServices($clinic);
        if (empty($servicePool)) {
            $this->command->error('No services found. Please run MasterDataSeeder first.');
            return;
        }

        $pets = Pet::where('clinic_id', $clinic->id)->get();
        if ($pets->isEmpty()) {
            $this->command->error('No pets found. Please seed pets first.');
            return;
        }
        $petProfiles = $this->generatePetProfiles($pets);

        $vets = Admin::where('role', 'like', '%vet%')->where('clinic_id', $clinic->id)->pluck('id')->toArray();
        if (empty($vets)) {
            $vets = [Admin::where('clinic_id', $clinic->id)->first()->id];
        }

        $startDate = Carbon::now()->subMonths(24);
        $totalDays = 730;
        $totalGenerated = 0;
        $stats = ['categories' => ['Consultation' => 0, 'Vaccination' => 0, 'Grooming' => 0, 'Laboratory' => 0], 'status' => ['completed' => 0, 'cancelled' => 0, 'rescheduled' => 0]];

        $this->command->getOutput()->progressStart($totalDays);

        for ($i = 0; $i < $totalDays; $i++) {
            $currentDate = $startDate->copy()->addDays($i);
            $month = $currentDate->month;
            $boost = 1.0;
            if ($month >= 3 && $month <= 5) $boost += 0.3;
            if ($month == 12) $boost += 0.4;
            if ($month >= 6 && $month <= 10) $boost += 0.2;

            $dailyCount = max(0, (int)round(2.7 * $boost + rand(-2, 3)));

            for ($j = 0; $j < $dailyCount; $j++) {
                $petId = $this->weightedSelectPet($petProfiles);
                $profile = $petProfiles[$petId];
                $category = $this->selectCategoryWithBias($profile, $month);
                $service = $servicePool[$category][array_rand($servicePool[$category])];
                $statusRoll = rand(1, 100);
                $status = $statusRoll > 95 ? 'rescheduled' : ($statusRoll > 85 ? 'cancelled' : 'completed');

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
                    'clinic_id' => $clinic->id,
                ]);

                $totalGenerated++;
                $stats['categories'][$category]++;
                $stats['status'][$status]++;
            }
            $this->command->getOutput()->progressAdvance();
        }

        $this->command->getOutput()->progressFinish();
        $this->displaySummary($totalGenerated, $stats);
    }

    private function resolveServices($clinic)
    {
        $pool = [];
        $services = Service::where('clinic_id', $clinic->id)->get();
        foreach ($services as $s) {
            $cat = $s->category;
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
            $freqRoll = rand(1, 100);
            $weight = $freqRoll <= 10 ? 6 : ($freqRoll <= 50 ? 3 : 1);
            $intRoll = rand(1, 100);
            $interest = $intRoll <= 20 ? 'Groomer' : ($intRoll <= 40 ? 'Chronic' : 'General');
            $profiles[$pet->id] = ['id' => $pet->id, 'weight' => $weight, 'interest' => $interest];
        }
        return $profiles;
    }

    private function weightedSelectPet($profiles)
    {
        $totalWeight = array_sum(array_column($profiles, 'weight'));
        $roll = rand(1, $totalWeight);
        $curr = 0;
        foreach ($profiles as $id => $p) {
            $curr += $p['weight'];
            if ($roll <= $curr) return $id;
        }
        return array_key_first($profiles);
    }

    private function selectCategoryWithBias($profile, $month)
    {
        $biasRange = rand(60, 75);
        $roll = rand(1, 100);
        if (in_array($month, [3, 4, 5, 12]) && rand(1, 100) <= 20) return 'Grooming';
        if ($profile['interest'] === 'Groomer' && $roll <= $biasRange) return 'Grooming';
        if ($profile['interest'] === 'Chronic' && $roll <= $biasRange) return rand(1, 2) == 1 ? 'Consultation' : 'Laboratory';
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
    }
}

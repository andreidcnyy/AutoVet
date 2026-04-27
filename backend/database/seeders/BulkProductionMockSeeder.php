<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Clinic;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BulkProductionMockSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) return;

        // TARGET: 50 Total Clients, 101 Total Pets
        $currentOwnersCount = Owner::withoutGlobalScopes()->count();
        $totalPetsCreatedCount = Pet::withoutGlobalScopes()->count();

        if ($currentOwnersCount >= 50 && $totalPetsCreatedCount >= 101) {
            return;
        }

        $canine = Species::where('name', 'Canine')->first();
        $feline = Species::where('name', 'Feline')->first();
        if (!$canine) $canine = Species::create(['name' => 'Canine', 'status' => 'Active', 'clinic_id' => $clinic->id]);
        if (!$feline) $feline = Species::create(['name' => 'Feline', 'status' => 'Active', 'clinic_id' => $clinic->id]);

        $breeds = Breed::all();
        $pool = Service::whereIn('category', ['Consultation', 'Vaccination', 'Grooming', 'Laboratory'])->get();
        if ($pool->isEmpty()) {
            $this->call(ServicesSeeder::class);
            $pool = Service::whereIn('category', ['Consultation', 'Vaccination', 'Grooming', 'Laboratory'])->get();
        }

        $ownersToCreate = max(0, 50 - $currentOwnersCount);
        $totalPets = $totalPetsCreatedCount;
        $now = Carbon::now('Asia/Manila');

        for ($i = 1; $i <= $ownersToCreate; $i++) {
            $owner = Owner::create([
                'name' => "Production Client " . ($currentOwnersCount + $i),
                'email' => "client.prod." . ($currentOwnersCount + $i) . "@autovet.ph",
                'phone' => "0917" . str_pad(rand(0, 9999999), 7, '0', STR_PAD_LEFT),
                'address' => "Metro Manila",
                'clinic_id' => $clinic->id,
            ]);

            // Assign pets to reach exactly 101 total in DB
            $petsForThisOwner = 2;
            if (($totalPets + $petsForThisOwner) > 101) {
                $petsForThisOwner = 101 - $totalPets;
            }

            for ($j = 1; $j <= $petsForThisOwner; $j++) {
                $species = rand(0, 1) == 0 ? $canine : $feline;
                $speciesBreeds = $breeds->where('species_id', $species->id);
                $breed = $speciesBreeds->count() > 0 ? $speciesBreeds->random() : Breed::first();
                
                $pet = Pet::create([
                    'name' => "Pet " . ($currentOwnersCount + $i) . "-{$j}",
                    'owner_id' => $owner->id,
                    'species_id' => $species->id,
                    'breed_id' => $breed->id,
                    'date_of_birth' => $now->copy()->subMonths(rand(6, 120))->toDateString(),
                    'weight' => rand(2, 30),
                    'weight_unit' => 'kg',
                    'status' => 'Active',
                    'sex' => rand(0, 1) == 0 ? 'Male' : 'Female',
                    'clinic_id' => $clinic->id,
                ]);

                DB::table('patients')->insert([
                    'id' => $pet->id,
                    'name' => $pet->name,
                    'species' => $species->name,
                    'owner_name' => $owner->name,
                    'owner_email' => $owner->email,
                    'status' => 'Healthy',
                    'clinic_id' => $clinic->id,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);

                $totalPets++;

                // Small amount of history for each NEW pet to boost AI
                for ($m = 0; $m <= 3; $m++) {
                    $monthDate = $now->copy()->subMonths($m);
                    $svc = $pool->random();
                    Appointment::create([
                        'pet_id' => $pet->id,
                        'service_id' => $svc->id,
                        'title' => $svc->category . ' for ' . $pet->name,
                        'date' => $monthDate->copy()->subDays(rand(1, 25))->toDateString(),
                        'time' => '09:00 AM',
                        'status' => 'Approved',
                        'clinic_id' => $clinic->id,
                    ]);
                }
            }
        }
    }
}

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

        // Truncate existing data to reach EXACT numbers requested
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Owner::truncate();
        Pet::truncate();
        DB::table('patients')->truncate();
        Appointment::truncate();
        Invoice::truncate();
        DB::table('invoice_items')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $canine = Species::where('name', 'Canine')->first();
        $feline = Species::where('name', 'Feline')->first();
        $breeds = Breed::all();
        $services = Service::all();

        // GOAL: 50 Total Clients, 101 Total Pets
        // Strategy: 49 clients with 2 pets each (98 pets) + 1 client with 3 pets = 101 pets.
        
        $totalPetsCreated = 0;

        for ($i = 1; $i <= 50; $i++) {
            $owner = Owner::create([
                'name' => "Production Client {$i}",
                'email' => "client.prod.{$i}@autovet.ph",
                'phone' => "0917" . str_pad($i, 7, '0', STR_PAD_LEFT),
                'address' => "Metro Manila",
                'clinic_id' => $clinic->id,
            ]);

            // Assign pets: 49 owners get 2, last owner gets 3
            $petsToCreate = ($i < 50) ? 2 : 3;

            for ($j = 1; $j <= $petsToCreate; $j++) {
                $species = rand(0, 1) == 0 ? $canine : $feline;
                $breed = $breeds->where('species_id', $species->id)->random();
                
                $pet = Pet::create([
                    'name' => "Pet {$i}-{$j}",
                    'owner_id' => $owner->id,
                    'species_id' => $species->id,
                    'breed_id' => $breed->id,
                    'date_of_birth' => Carbon::now()->subMonths(rand(6, 120))->toDateString(),
                    'weight' => rand(2, 30),
                    'weight_unit' => 'kg',
                    'status' => 'Active',
                    'sex' => rand(0, 1) == 0 ? 'Male' : 'Female',
                    'clinic_id' => $clinic->id,
                ]);

                // Sync to patients
                DB::table('patients')->insert([
                    'id' => $pet->id,
                    'name' => $pet->name,
                    'species' => $species->name,
                    'owner_name' => $owner->name,
                    'owner_email' => $owner->email,
                    'status' => 'Healthy',
                    'clinic_id' => $clinic->id,
                ]);

                $totalPetsCreated++;

                // Create a reasonable amount of appointments (not 1750!)
                // Let's create about 10-15 appointments for "Today"
                if ($totalPetsCreated <= 15) {
                    Appointment::create([
                        'pet_id' => $pet->id,
                        'service_id' => $services->random()->id,
                        'title' => 'Routine Checkup',
                        'date' => Carbon::now('Asia/Manila')->toDateString(),
                        'time' => str_pad(rand(8, 11), 2, '0', STR_PAD_LEFT) . ':00 AM',
                        'status' => 'Approved', // Match our new filter
                        'clinic_id' => $clinic->id,
                    ]);
                }
            }
        }
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Clinic;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PatientPetSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        $canine = Species::where('name', 'Canine')->where('clinic_id', $clinic->id)->first();
        $feline = Species::where('name', 'Feline')->where('clinic_id', $clinic->id)->first();

        if (!$canine) $canine = Species::create(['name' => 'Canine', 'status' => 'Active', 'clinic_id' => $clinic->id]);
        if (!$feline) $feline = Species::create(['name' => 'Feline', 'status' => 'Active', 'clinic_id' => $clinic->id]);

        $ownersData = [
            ['name' => 'Maria Santos', 'email' => 'maria.santos@example.com', 'phone' => '09171234567', 'address' => '456 Rizal St', 'city' => 'Quezon City', 'province' => 'Metro Manila', 'zip' => '1100', 'pets' => [['name' => 'Luna', 'species_id' => $feline->id, 'breed_name' => 'Persian Cat', 'sex' => 'Female', 'weight' => 4.2, 'color' => 'White'], ['name' => 'Coco', 'species_id' => $canine->id, 'breed_name' => 'Poodle', 'sex' => 'Male', 'weight' => 6.5, 'color' => 'Brown']]],
            ['name' => 'Juan Dela Cruz', 'email' => 'juan.delacruz@example.com', 'phone' => '09187654321', 'address' => '789 Bonifacio Ave', 'city' => 'Makati City', 'province' => 'Metro Manila', 'zip' => '1200', 'pets' => [['name' => 'Tagpi', 'species_id' => $canine->id, 'breed_name' => 'Aspin', 'sex' => 'Male', 'weight' => 12.0, 'color' => 'Black and White']]]
        ];

        foreach ($ownersData as $data) {
            $petsData = $data['pets'];
            unset($data['pets']);
            $data['clinic_id'] = $clinic->id;

            $owner = Owner::updateOrCreate(['email' => $data['email'], 'clinic_id' => $clinic->id], $data);

            foreach ($petsData as $petData) {
                $breedName = $petData['breed_name'];
                unset($petData['breed_name']);

                $breed = Breed::updateOrCreate(['name' => $breedName, 'species_id' => $petData['species_id'], 'clinic_id' => $clinic->id], ['clinic_id' => $clinic->id]);

                $petData['owner_id'] = $owner->id;
                $petData['breed_id'] = $breed->id;
                $petData['date_of_birth'] = Carbon::now()->subMonths(rand(6, 60))->toDateString();
                $petData['status'] = 'Active';
                $petData['weight_unit'] = 'kg';
                $petData['clinic_id'] = $clinic->id;

                $pet = Pet::updateOrCreate(['owner_id' => $owner->id, 'name' => $petData['name'], 'clinic_id' => $clinic->id], $petData);

                if (DB::connection()->getSchemaBuilder()->hasTable('patients')) {
                    DB::table('patients')->updateOrInsert(['id' => $pet->id], ['name' => $pet->name, 'species' => $pet->species->name, 'owner_name' => $owner->name, 'owner_email' => $owner->email, 'status' => 'Healthy', 'clinic_id' => $clinic->id, 'created_at' => now(), 'updated_at' => now()]);
                }
            }
        }
    }
}

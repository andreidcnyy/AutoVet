<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MigratePatientsToOwnersAndPetsSeeder extends Seeder
{
    public function run(): void
    {
        $patients = DB::table('patients')->get();

        foreach ($patients as $patient) {
            $ownerId = DB::table('owners')->insertGetId([
                'name' => $patient->owner_name ?? 'Unknown Owner',
                'phone' => $patient->owner_phone,
                'email' => $patient->owner_email,
                'address' => $patient->owner_address ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            $speciesName = $patient->species ?: 'Unknown';
            $speciesObj = DB::table('species')->where('name', $speciesName)->first();
            if (!$speciesObj) {
                $speciesId = DB::table('species')->insertGetId([
                    'name' => $speciesName,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $speciesId = $speciesObj->id;
            }

            $breedId = null;
            if (!empty($patient->breed)) {
                $breedObj = DB::table('breeds')->where('name', $patient->breed)->where('species_id', $speciesId)->first();
                if (!$breedObj) {
                    $breedId = DB::table('breeds')->insertGetId([
                        'species_id' => $speciesId,
                        'name' => $patient->breed,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    $breedId = $breedObj->id;
                }
            }

            $petId = DB::table('pets')->insertGetId([
                'id' => $patient->id,
                'owner_id' => $ownerId,
                'name' => $patient->name,
                'species_id' => $speciesId,
                'breed_id' => $breedId,
                'date_of_birth' => $patient->date_of_birth,
                'gender' => $patient->gender,
                'color' => $patient->color,
                'weight_value' => (float) filter_var($patient->weight, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION),
                'weight_unit' => stripos($patient->weight, 'lbs') !== false ? 'lbs' : 'kg',
                'status' => $patient->status,
                'allergies' => $patient->allergies,
                'medication' => $patient->medication,
                'notes' => $patient->notes,
                'photo' => $patient->photo,
                'created_at' => $patient->created_at,
                'updated_at' => $patient->updated_at,
            ]);
        }
    }
}

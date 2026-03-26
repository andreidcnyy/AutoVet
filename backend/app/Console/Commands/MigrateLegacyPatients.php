<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Patient;
use App\Models\Pet;
use App\Models\Owner;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\MedicalRecord;
use Illuminate\Support\Facades\DB;

class MigrateLegacyPatients extends Command
{
    protected $signature = 'migrate:legacy-patients';
    protected $description = 'Migrate legacy patient data to owners and pets structure';

    public function handle()
    {
        $this->info('Starting legacy patient migration...');

        $patients = Patient::withTrashed()->get();
        $count = 0;
        $errors = 0;

        foreach ($patients as $patient) {
            DB::beginTransaction();
            try {
                // 1. Handle Owner (De-duplication)
                $owner = Owner::updateOrCreate(
                    [
                        'name' => $patient->owner_name,
                        'phone' => $patient->owner_phone ?? '',
                    ],
                    [
                        'email' => $patient->owner_email,
                        'address' => $patient->owner_address,
                        'city' => $patient->owner_city,
                        'province' => $patient->owner_province,
                        'zip' => $patient->owner_zip,
                    ]
                );

                // 2. Handle Species
                $species = null;
                if ($patient->species) {
                    $species = Species::firstOrCreate(['name' => $patient->species]);
                }

                // 3. Handle Breed
                $breed = null;
                if ($patient->breed && $species) {
                    $breed = Breed::firstOrCreate([
                        'name' => $patient->breed,
                        'species_id' => $species->id
                    ]);
                }

                // 4. Handle Pet
                // Check if already migrated
                $pet = Pet::where('legacy_patient_id', $patient->id)->first();
                
                if (!$pet) {
                    $pet = Pet::create([
                        'legacy_patient_id' => $patient->id,
                        'owner_id' => $owner->id,
                        'name' => $patient->name,
                        'species_id' => $species?->id,
                        'breed_id' => $breed?->id,
                        'date_of_birth' => $patient->date_of_birth,
                        'gender' => $patient->gender,
                        'color' => $patient->color,
                        'weight_value' => $this->parseWeight($patient->weight),
                        'weight_unit' => 'kg',
                        'status' => $patient->status,
                        'allergies' => $patient->allergies,
                        'medication' => $patient->medication,
                        'notes' => $patient->notes,
                        'photo' => $patient->photo,
                        'deleted_at' => $patient->deleted_at,
                    ]);
                }

                // 5. Update Relationships
                // Note: Columns were renamed from patient_id to pet_id in migrations
                // We need to update the actual values from patient->id to pet->id
                
                // IMPORTANT: We only update those that currently match the OLD patient id
                // Use a direct DB update to avoid model events if necessary, or just use models
                
                Appointment::where('pet_id', $patient->id)->update(['pet_id' => $pet->id]);
                Invoice::where('pet_id', $patient->id)->update(['pet_id' => $pet->id]);
                MedicalRecord::where('pet_id', $patient->id)->update(['pet_id' => $pet->id]);

                DB::commit();
                $count++;
            } catch (\Exception $e) {
                DB::rollBack();
                $this->error("Failed to migrate patient ID {$patient->id}: " . $e->getMessage());
                $errors++;
            }
        }

        $this->info("Migration completed. {$count} patients migrated. {$errors} errors.");
    }

    private function parseWeight($weightStr)
    {
        if (!$weightStr) return null;
        // Extract numbers from string like "10.5 kg" or "10.5"
        preg_match('/[\d\.]+/', $weightStr, $matches);
        return isset($matches[0]) ? (float)$matches[0] : null;
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Admin;
use App\Models\Clinic;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\PortalUser;
use App\Enums\Roles;

class AiClinicSeeder extends Seeder
{
    public function run(): void
    {
        $source = Clinic::first();

        // ── 1. Create AI demo clinic ──────────────────────────────────────────
        $aiClinic = Clinic::updateOrCreate(
            ['email' => 'contact@autovet-ai.com'],
            [
                'clinic_name'       => 'AutoVet AI Demo Clinic',
                'owner_name'        => 'Dr. AI Specialist',
                'contact_number'    => '09000000001',
                'address'           => '1 Innovation Drive, Tech City',
                'status'            => 'active',
                'subscription_tier' => 'premium',
            ]
        );

        // ── 2. Create clinic admin account ────────────────────────────────────
        Admin::updateOrCreate(
            ['email' => 'ai.admin@autovet.com'],
            [
                'name'      => 'AI Demo Admin',
                'password'  => Hash::make('password123'),
                'role'      => Roles::CLINIC_ADMIN->value,
                'status'    => 'active',
                'clinic_id' => $aiClinic->id,
            ]
        );

        // ── 3. Clone species ──────────────────────────────────────────────────
        $speciesMap = [];
        $sourceSpecies = DB::table('species')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceSpecies as $sp) {
            $existing = DB::table('species')
                ->where('clinic_id', $aiClinic->id)
                ->where('name', $sp->name)
                ->first();

            if ($existing) {
                $speciesMap[$sp->id] = $existing->id;
            } else {
                $newId = DB::table('species')->insertGetId([
                    'clinic_id'  => $aiClinic->id,
                    'name'       => $sp->name,
                    'status'     => $sp->status,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $speciesMap[$sp->id] = $newId;
            }
        }

        // ── 4. Clone breeds ───────────────────────────────────────────────────
        $breedMap = [];
        $sourceBreeds = DB::table('breeds')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceBreeds as $br) {
            $mappedSpeciesId = $speciesMap[$br->species_id] ?? null;
            if (!$mappedSpeciesId) continue;

            $existing = DB::table('breeds')
                ->where('clinic_id', $aiClinic->id)
                ->where('name', $br->name)
                ->where('species_id', $mappedSpeciesId)
                ->first();

            if ($existing) {
                $breedMap[$br->id] = $existing->id;
            } else {
                $newId = DB::table('breeds')->insertGetId([
                    'clinic_id'  => $aiClinic->id,
                    'species_id' => $mappedSpeciesId,
                    'name'       => $br->name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $breedMap[$br->id] = $newId;
            }
        }

        // ── 5. Clone services ─────────────────────────────────────────────────
        $serviceMap = [];
        $sourceServices = DB::table('services')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceServices as $svc) {
            $existing = DB::table('services')
                ->where('clinic_id', $aiClinic->id)
                ->where('name', $svc->name)
                ->whereNull('deleted_at')
                ->first();

            if ($existing) {
                $serviceMap[$svc->id] = $existing->id;
            } else {
                $newId = DB::table('services')->insertGetId([
                    'clinic_id'        => $aiClinic->id,
                    'name'             => $svc->name,
                    'description'      => $svc->description,
                    'price'            => $svc->price,
                    'pricing_mode'     => $svc->pricing_mode ?? null,
                    'pricing_type'     => $svc->pricing_type ?? null,
                    'measurement_basis'=> $svc->measurement_basis ?? null,
                    'base_price'       => $svc->base_price ?? null,
                    'category'         => $svc->category,
                    'status'           => $svc->status,
                    'uuid'             => Str::uuid(),
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]);
                $serviceMap[$svc->id] = $newId;
            }
        }

        // ── 6. Clone inventory ────────────────────────────────────────────────
        $inventoryMap = [];
        $sourceInventory = DB::table('inventories')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceInventory as $inv) {
            $existing = DB::table('inventories')
                ->where('clinic_id', $aiClinic->id)
                ->where('item_name', $inv->item_name)
                ->whereNull('deleted_at')
                ->first();

            if ($existing) {
                $inventoryMap[$inv->id] = $existing->id;
            } else {
                $newId = DB::table('inventories')->insertGetId([
                    'clinic_id'          => $aiClinic->id,
                    'item_name'          => $inv->item_name,
                    'code'               => $inv->code,
                    'category'           => $inv->category ?? null,
                    'stock_level'        => $inv->stock_level,
                    'min_stock_level'    => $inv->min_stock_level,
                    'unit'               => $inv->unit ?? null,
                    'buying_price'       => $inv->buying_price ?? null,
                    'selling_price'      => $inv->selling_price ?? null,
                    'expiration_date'    => $inv->expiration_date ?? null,
                    'is_billable'        => $inv->is_billable ?? 1,
                    'deduct_on_finalize' => $inv->deduct_on_finalize ?? 1,
                    'uuid'               => Str::uuid(),
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
                $inventoryMap[$inv->id] = $newId;
            }
        }

        // ── 7. Clone owners + portal users ────────────────────────────────────
        $ownerMap = [];
        $sourceOwners = DB::table('owners')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceOwners as $ow) {
            $aiEmail = 'ai.' . $ow->email;

            $existing = DB::table('owners')
                ->where('clinic_id', $aiClinic->id)
                ->where('email', $aiEmail)
                ->whereNull('deleted_at')
                ->first();

            if ($existing) {
                $ownerMap[$ow->id] = $existing->id;
                continue;
            }

            // Clone portal user if one exists
            $portalUserId = null;
            if ($ow->user_id) {
                $srcPortal = DB::table('portal_users')->find($ow->user_id);
                if ($srcPortal) {
                    $existingPortal = DB::table('portal_users')
                        ->where('email', 'ai.' . $srcPortal->email)
                        ->first();

                    if ($existingPortal) {
                        $portalUserId = $existingPortal->id;
                    } else {
                        $portalUserId = DB::table('portal_users')->insertGetId([
                            'clinic_id'         => $aiClinic->id,
                            'name'              => $srcPortal->name,
                            'email'             => 'ai.' . $srcPortal->email,
                            'phone'             => $srcPortal->phone,
                            'address'           => $srcPortal->address,
                            'city'              => $srcPortal->city,
                            'province'          => $srcPortal->province,
                            'zip'               => $srcPortal->zip,
                            'password'          => $srcPortal->password,
                            'status'            => $srcPortal->status,
                            'email_verified_at' => $srcPortal->email_verified_at,
                            'created_at'        => now(),
                            'updated_at'        => now(),
                        ]);
                    }
                }
            }

            $newOwnerId = DB::table('owners')->insertGetId([
                'clinic_id'  => $aiClinic->id,
                'name'       => $ow->name,
                'email'      => $aiEmail,
                'phone'      => $ow->phone,
                'address'    => $ow->address,
                'city'       => $ow->city,
                'province'   => $ow->province,
                'zip'        => $ow->zip,
                'user_id'    => $portalUserId,
                'uuid'       => Str::uuid(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $ownerMap[$ow->id] = $newOwnerId;
        }

        // ── 8. Clone pets ─────────────────────────────────────────────────────
        $petMap = [];
        $sourcePets = DB::table('pets')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourcePets as $pet) {
            $mappedOwner = $ownerMap[$pet->owner_id] ?? null;
            if (!$mappedOwner) continue;

            $existing = DB::table('pets')
                ->where('clinic_id', $aiClinic->id)
                ->where('owner_id', $mappedOwner)
                ->where('name', $pet->name)
                ->whereNull('deleted_at')
                ->first();

            if ($existing) {
                $petMap[$pet->id] = $existing->id;
                continue;
            }

            $newPetId = DB::table('pets')->insertGetId([
                'clinic_id'       => $aiClinic->id,
                'owner_id'        => $mappedOwner,
                'name'            => $pet->name,
                'species_id'      => $speciesMap[$pet->species_id] ?? $pet->species_id,
                'breed_id'        => isset($pet->breed_id) ? ($breedMap[$pet->breed_id] ?? null) : null,
                'date_of_birth'   => $pet->date_of_birth,
                'sex'             => $pet->sex,
                'color'           => $pet->color,
                'weight'          => $pet->weight,
                'weight_unit'     => $pet->weight_unit ?? 'kg',
                'status'          => $pet->status,
                'allergies'       => $pet->allergies,
                'notes'           => $pet->notes,
                'uuid'            => Str::uuid(),
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
            $petMap[$pet->id] = $newPetId;
        }

        // ── 9. Clone appointments ─────────────────────────────────────────────
        $appointmentMap = [];
        $sourceAppts = DB::table('appointments')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceAppts as $appt) {
            $mappedPet = $petMap[$appt->pet_id] ?? null;
            if (!$mappedPet) continue;

            $newApptId = DB::table('appointments')->insertGetId([
                'clinic_id'  => $aiClinic->id,
                'pet_id'     => $mappedPet,
                'service_id' => isset($appt->service_id) ? ($serviceMap[$appt->service_id] ?? null) : null,
                'title'      => $appt->title,
                'date'       => $appt->date,
                'time'       => $appt->time,
                'category'   => $appt->category,
                'status'     => $appt->status,
                'notes'      => $appt->notes,
                'uuid'       => Str::uuid(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $appointmentMap[$appt->id] = $newApptId;
        }

        // ── 10. Clone medical records ─────────────────────────────────────────
        $sourceMedRecords = DB::table('medical_records')
            ->where('clinic_id', $source->id)
            ->whereNull('deleted_at')
            ->get();

        foreach ($sourceMedRecords as $rec) {
            $mappedPet  = $petMap[$rec->pet_id] ?? null;
            $mappedAppt = isset($rec->appointment_id) ? ($appointmentMap[$rec->appointment_id] ?? null) : null;
            if (!$mappedPet) continue;

            DB::table('medical_records')->insert([
                'clinic_id'      => $aiClinic->id,
                'pet_id'         => $mappedPet,
                'appointment_id' => $mappedAppt,
                'chief_complaint'=> $rec->chief_complaint,
                'findings'       => $rec->findings,
                'diagnosis'      => $rec->diagnosis,
                'treatment_plan' => $rec->treatment_plan,
                'notes'          => $rec->notes,
                'follow_up_date' => $rec->follow_up_date,
                'follow_up_time' => $rec->follow_up_time,
                'uuid'           => Str::uuid(),
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }

        $this->command->info("AI Demo Clinic created (ID: {$aiClinic->id}).");
        $this->command->info("Login: ai.admin@autovet.com / password123");
        $this->command->info("Cloned: " . count($ownerMap) . " owners, " . count($petMap) . " pets, " . count($appointmentMap) . " appointments.");
    }
}

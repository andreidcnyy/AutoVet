<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Traits\HasInternalNotifications;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WalkInController extends Controller
{
    use HasInternalNotifications;

    public function register(Request $request)
    {
        $request->validate([
            'date'                => 'required|date',
            'time'                => 'required|date_format:H:i',
            'service_id'          => 'nullable|exists:services,id',
            'service_ids'         => 'nullable|array',
            'service_ids.*'       => 'exists:services,id',
            'notes'               => 'nullable|string',
            'is_emergency'        => 'nullable|boolean',

            // Either new_owner OR owner_id must be provided
            'owner_id'            => 'nullable|exists:owners,id',
            'new_owner'           => 'nullable|array',
            'new_owner.name'      => 'required_with:new_owner|string|max:255',
            'new_owner.phone'     => 'required_with:new_owner|string|size:11',
            'new_owner.address'   => 'nullable|string|max:255',
            'new_owner.city'      => 'nullable|string|max:100',
            'new_owner.province'  => 'nullable|string|max:100',

            // New pet is always created fresh for walk-ins
            'new_pet'             => 'required|array',
            'new_pet.name'        => 'required|string|max:255',
            'new_pet.species_id'  => 'required|exists:species,id',
            'new_pet.breed_id'    => 'nullable|exists:breeds,id',
        ]);

        if (empty($request->owner_id) && empty($request->new_owner)) {
            return response()->json(['message' => 'Provide either an existing owner or new owner information.'], 422);
        }

        $serviceId = $request->service_id ?? ($request->service_ids[0] ?? null);
        if (!$serviceId) {
            return response()->json(['message' => 'Please select at least one service.'], 422);
        }

        try {
            $result = DB::transaction(function () use ($request, $serviceId) {
                // Resolve or create owner
                if ($request->filled('owner_id')) {
                    $owner = Owner::findOrFail($request->owner_id);
                } else {
                    $ownerData = $request->new_owner;
                    // Duplicate phone check
                    $existing = Owner::where('phone', $ownerData['phone'])->first();
                    if ($existing) {
                        throw new \Exception("An owner with phone {$ownerData['phone']} already exists: {$existing->name}. Use 'Link Existing Owner' instead.");
                    }
                    $owner = Owner::create([
                        'name'     => $ownerData['name'],
                        'phone'    => $ownerData['phone'],
                        'address'  => $ownerData['address'] ?? null,
                        'city'     => $ownerData['city'] ?? null,
                        'province' => $ownerData['province'] ?? null,
                    ]);
                }

                // Create pet under owner
                $petData = $request->new_pet;

                // Duplicate pet name check under same owner
                $dupePet = Pet::where('owner_id', $owner->id)->where('name', $petData['name'])->first();
                if ($dupePet) {
                    throw new \Exception("A pet named '{$petData['name']}' already exists for this owner.");
                }

                $pet = Pet::create([
                    'owner_id'   => $owner->id,
                    'name'       => $petData['name'],
                    'species_id' => $petData['species_id'],
                    'breed_id'   => $petData['breed_id'] ?? null,
                ]);

                $service = Service::find($serviceId);
                $serviceIds = $request->service_ids ?? [$serviceId];

                $appointment = Appointment::create([
                    'pet_id'      => $pet->id,
                    'service_id'  => $serviceId,
                    'title'       => $service ? $service->name : 'Walk-in Visit',
                    'date'        => $request->date,
                    'time'        => $request->time,
                    'notes'       => $request->notes ?? null,
                    'is_walk_in'  => true,
                    'status'      => $request->boolean('is_emergency') ? 'approved' : 'approved',
                    'category'    => $service ? $service->category : null,
                ]);

                $appointment->services()->sync($serviceIds);

                $this->createInternalNotification(
                    'WalkIn',
                    ($request->boolean('is_emergency') ? '[EMERGENCY] ' : '') . 'Walk-in Registration',
                    "Walk-in registered: {$pet->name} (owner: {$owner->name}) on " . date('M d, Y', strtotime($request->date)) . " at " . date('g:i A', strtotime($request->time)) . ".",
                    ['appointment_id' => $appointment->id]
                );

                return $appointment->load(['pet.owner', 'service', 'services']);
            });

            // Broadcast AFTER the transaction commits so subscribers' refetch
            // sees the committed appointment row.
            event(new \App\Events\AppointmentCreated($result));

            return response()->json($result, 201);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}

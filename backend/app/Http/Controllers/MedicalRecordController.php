<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Models\MedicalRecord;
use Illuminate\Http\Request;
use App\Traits\IdentifiesPortalOwner;

/**
 * MedicalRecordController
 *
 * All role checks now use the centralized Roles enum to prevent
 * string mismatch bugs (previous code used 'vet'/'admin' which
 * didn't match the actual role values stored in the database).
 */
class MedicalRecordController extends Controller
{
    use IdentifiesPortalOwner;

    protected $clientNotificationService;

    public function __construct(
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->clientNotificationService = $clientNotificationService;
        $this->authorizeResource(MedicalRecord::class, 'medical_record');
    }

    public function index(Request $request)
    {
        $user = auth()->user();
        $query = MedicalRecord::with(['pet', 'vet', 'appointment.service']);

        if ($ownerId = $this->getPortalOwnerId()) {
            $query->whereHas('pet', function($q) use ($ownerId) {
                $q->where('owner_id', $ownerId);
            });
        } elseif ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'nullable|exists:appointments,id',
            'vet_id'          => 'nullable|exists:admins,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'follow_up_time'  => 'nullable',
        ]);

        if (!isset($validated['vet_id']) || empty($validated['vet_id'])) {
            $user = auth()->user();
            if ($user && $user->role === Roles::VETERINARIAN->value) {
                $validated['vet_id'] = $user->id;
            }
        }

        $record = MedicalRecord::create($validated);

        // Notify client if record is finalized with a diagnosis
        if ($record->diagnosis) {
            $this->clientNotificationService->notifyMedicalRecordUpdate($record);
        }

        return response()->json($record->load(['pet', 'vet', 'appointment.service']), 201);
    }

    public function show(MedicalRecord $medicalRecord)
    {
        return response()->json($medicalRecord->load(['pet', 'vet', 'appointment.service']));
    }

    public function update(Request $request, MedicalRecord $medicalRecord)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'nullable|exists:appointments,id',
            'vet_id'          => 'nullable|exists:admins,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'follow_up_time'  => 'nullable',
        ]);

        if (!isset($validated['vet_id']) || empty($validated['vet_id'])) {
            $user = auth()->user();
            if ($user && $user->role === Roles::VETERINARIAN->value) {
                $validated['vet_id'] = $user->id;
            }
        }

        $medicalRecord->update($validated);
        return response()->json($medicalRecord->load(['pet', 'vet', 'appointment.service']));
    }

    public function destroy(MedicalRecord $medicalRecord)
    {
        $medicalRecord->delete();
        return response()->json(null, 204);
    }
}

<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Models\MedicalRecord;
use Illuminate\Http\Request;

/**
 * MedicalRecordController
 *
 * All role checks now use the centralized Roles enum to prevent
 * string mismatch bugs (previous code used 'vet'/'admin' which
 * didn't match the actual role values stored in the database).
 */
class MedicalRecordController extends Controller
{
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
        $query = MedicalRecord::with(['pet', 'vet']);

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            $query->whereHas('pet', function ($q) use ($user) {
                $q->where('owner_id', $user->owner?->id);
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
            'appointment_id'  => 'required|exists:appointments,id',
            'vet_id'          => 'nullable|exists:admins,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
        ]);

        // Auto-assign the logged-in user as vet if they are a clinical role
        if (empty($validated['vet_id']) && auth()->check()) {
            $user = auth()->user();
            $userRole = property_exists($user, 'role') ? $user->role : null;
            if ($userRole && in_array($userRole, Roles::clinicalRoles())) {
                $validated['vet_id'] = auth()->id();
            }
        }

        $record = MedicalRecord::create($validated);

        try {
            $record->load('pet.owner');
            $owner = $record->pet->owner;
            if ($owner) {
                $this->clientNotificationService->sendFromTemplate(
                    $owner,
                    'medical_summary_notice',
                    'email',
                    [
                        'pet_name' => $record->pet->name,
                        'diagnosis' => $record->diagnosis ?: 'N/A'
                    ],
                    'automated',
                    $record
                );
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send automated medical record notification: " . $e->getMessage());
        }

        return response()->json($record->load(['pet', 'vet']), 201);
    }

    public function show(MedicalRecord $medicalRecord)
    {
        return response()->json($medicalRecord->load(['pet', 'vet']));
    }

    public function update(Request $request, MedicalRecord $medicalRecord)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'required|exists:appointments,id',
            'vet_id'          => 'nullable|exists:admins,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
        ]);

        // Only clinical staff (Veterinarian) may edit diagnosis
        if ($request->has('diagnosis') && auth()->check()) {
            $user = auth()->user();
            $userRole = property_exists($user, 'role') ? $user->role : null;
            if (!$userRole || !in_array($userRole, Roles::clinicalRoles())) {
                return response()->json([
                    'message' => 'Unauthorized. Only veterinarians may edit the diagnosis field.',
                ], 403);
            }
        }

        $medicalRecord->update($validated);
        return response()->json($medicalRecord->load(['pet', 'vet']));
    }

    public function destroy(MedicalRecord $medicalRecord)
    {
        // Deletion restricted to Admin or Veterinarian
        if (auth()->check()) {
            $user = auth()->user();
            $userRole = property_exists($user, 'role') ? $user->role : null;
            $allowedRoles = array_merge(Roles::adminRoles(), [Roles::VETERINARIAN->value]);
            if (!$userRole || !in_array($userRole, $allowedRoles)) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
        }

        $medicalRecord->delete();
        return response()->json(null, 204);
    }
}

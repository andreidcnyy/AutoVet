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
    public function index(Request $request)
    {
        $query = MedicalRecord::with(['pet', 'vet']);

        if ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pet_id'          => 'required|exists:pets,id',
            'appointment_id'  => 'required|exists:appointments,id',
            'vet_id'          => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
        ]);

        // Auto-assign the logged-in user as vet if they are a clinical role
        if (empty($validated['vet_id']) && auth()->check()) {
            $userRole = auth()->user()->role;
            if (in_array($userRole, Roles::clinicalRoles())) {
                $validated['vet_id'] = auth()->id();
            }
        }

        $record = MedicalRecord::create($validated);
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
            'vet_id'          => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings'        => 'nullable|string',
            'diagnosis'       => 'nullable|string',
            'treatment_plan'  => 'nullable|string',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
        ]);

        // Only clinical staff (Veterinarian) may edit diagnosis
        if ($request->has('diagnosis') && auth()->check()) {
            $userRole = auth()->user()->role;
            if (!in_array($userRole, Roles::clinicalRoles())) {
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
            $userRole = auth()->user()->role;
            $allowedRoles = array_merge(Roles::adminRoles(), [Roles::VETERINARIAN->value]);
            if (!in_array($userRole, $allowedRoles)) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
        }

        $medicalRecord->delete();
        return response()->json(null, 204);
    }
}

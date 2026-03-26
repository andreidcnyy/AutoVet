<?php

namespace App\Http\Controllers;

use App\Models\MedicalRecord;
use Illuminate\Http\Request;

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
            'pet_id' => 'required|exists:pets,id',
            'vet_id' => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'notes' => 'nullable|string',
            'follow_up_date' => 'nullable|date',
        ]);

        // Auto assign vet if auth user is Vet
        if (!$request->vet_id && auth()->check() && auth()->user()->role === 'vet') {
            $validated['vet_id'] = auth()->id();
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
            'pet_id' => 'required|exists:pets,id',
            'vet_id' => 'nullable|exists:users,id',
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'notes' => 'nullable|string',
            'follow_up_date' => 'nullable|date',
        ]);

        // Restrict diagnosis editing to Vets
        if ($request->has('diagnosis') && auth()->check() && auth()->user()->role !== 'vet') {
            return response()->json(['message' => 'Unauthorized. Only veterinarians can edit diagnosis.'], 403);
        }

        $medicalRecord->update($validated);
        return response()->json($medicalRecord->load(['pet', 'vet']));
    }

    public function destroy(MedicalRecord $medicalRecord)
    {
        if (auth()->check() && auth()->user()->role !== 'admin' && auth()->user()->role !== 'vet') {
             return response()->json(['message' => 'Unauthorized.'], 403);
        }
        $medicalRecord->delete();
        return response()->json(null, 204);
    }
}

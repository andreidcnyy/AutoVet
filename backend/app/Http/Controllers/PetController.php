<?php

namespace App\Http\Controllers;

use App\Models\Pet;
use Illuminate\Http\Request;

class PetController extends Controller
{
    public function index(Request $request)
    {
        $query = Pet::with(['owner', 'species', 'breed', 'sizeCategory']);
        
        if ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }
        
        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            'photo' => 'nullable|string',
        ]);

        if ($request->filled('photo') && preg_match('/^data:image\/(\w+);base64,/', $request->photo)) {
            $data = substr($request->photo, strpos($request->photo, ',') + 1);
            $data = base64_decode($data);
            $extension = explode('/', explode(':', substr($request->photo, 0, strpos($request->photo, ';')))[1])[1];
            $fileName = uniqid() . '.' . $extension;
            \Illuminate\Support\Facades\Storage::disk('public')->put('pets/' . $fileName, $data);
            $validated['photo'] = 'pets/' . $fileName;
        } elseif ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store('pets', 'public');
        }

        $pet = Pet::create($validated);
        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory']), 201);
    }

    public function show(Pet $pet)
    {
        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory', 'appointments.service', 'medicalRecords.vet', 'invoices']));
    }

    public function update(Request $request, Pet $pet)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            'photo' => 'nullable|string',
        ]);

        if ($request->filled('photo') && preg_match('/^data:image\/(\w+);base64,/', $request->photo)) {
            $data = substr($request->photo, strpos($request->photo, ',') + 1);
            $data = base64_decode($data);
            $extension = explode('/', explode(':', substr($request->photo, 0, strpos($request->photo, ';')))[1])[1];
            $fileName = uniqid() . '.' . $extension;
            \Illuminate\Support\Facades\Storage::disk('public')->put('pets/' . $fileName, $data);
            $validated['photo'] = 'pets/' . $fileName;
        } elseif ($request->hasFile('photo')) {
            $validated['photo'] = $request->file('photo')->store('pets', 'public');
        } else {
            // Keep existing photo if a URL was sent back unchanged
            if (isset($request->photo) && !preg_match('/^data:image/', $request->photo)) {
                // It's likely the existing path, so leave it untouched
                unset($validated['photo']);
            }
        }

        $pet->update($validated);
        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory']));
    }

    public function destroy(Pet $pet)
    {
        if (!auth()->user()->isAdmin() && !auth()->user()->isClinical()) {
            return response()->json(['message' => 'Unauthorized. Only Admins and Veterinarians can archive patient records.'], 403);
        }

        $pet->delete();
        return response()->json(null, 204);
    }
}

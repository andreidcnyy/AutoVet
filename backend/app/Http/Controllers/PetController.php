<?php

namespace App\Http\Controllers;

use App\Models\Pet;
use Illuminate\Http\Request;
use App\Traits\IdentifiesPortalOwner;

class PetController extends Controller
{
    use IdentifiesPortalOwner;

    public function __construct()
    {
        $this->authorizeResource(Pet::class, 'pet');
    }

    public function index(Request $request)
    {
        $user = auth()->user();
        // Removed 'invoices' and 'appointments' from eager loading in index to speed up list views
        $query = Pet::with(['owner', 'species', 'breed', 'sizeCategory']);
        
        if ($ownerId = $this->getPortalOwnerId()) {
            $query->where('owner_id', $ownerId);
        } elseif ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }

        $query->orderBy('created_at', 'desc');

        if ($request->has('per_page')) {
            return response()->json($query->paginate($request->per_page));
        }
        
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        if ($ownerId = $this->getPortalOwnerId()) {
            $request->merge(['owner_id' => $ownerId]);
        }

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
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'vet_id' => 'nullable|exists:admins,id',
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

        // Check for clinical fields to create an initial medical record
        if ($request->hasAny(['chief_complaint', 'findings', 'diagnosis', 'treatment_plan'])) {
            $recordVetId = $request->vet_id;
            if (!$recordVetId) {
                $user = auth()->user();
                if ($user && $user->role === \App\Enums\Roles::VETERINARIAN->value) {
                    $recordVetId = $user->id;
                }
            }

            $pet->medicalRecords()->create([
                'chief_complaint' => $request->chief_complaint,
                'findings'        => $request->findings,
                'diagnosis'       => $request->diagnosis,
                'treatment_plan'  => $request->treatment_plan,
                'notes'           => $request->notes,
                'vet_id'          => $recordVetId,
            ]);
        }

        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory'])->append(['total_paid', 'total_due', 'last_visit', 'next_due']), 201);
    }

    public function show(Pet $pet)
    {
        // Explicitly load relations and append attributes for the detail view
        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory', 'appointments.service', 'medicalRecords.vet', 'invoices'])
            ->append(['total_paid', 'total_due', 'last_visit', 'next_due']));
    }

    public function update(Request $request, Pet $pet)
    {
        if ($ownerId = $this->getPortalOwnerId()) {
            $request->merge(['owner_id' => $ownerId]);
        }

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
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'vet_id' => 'nullable|exists:admins,id',
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

        // Check for clinical fields to create a NEW medical record entry
        if ($request->hasAny(['chief_complaint', 'findings', 'diagnosis', 'treatment_plan'])) {
            // Only create if at least one clinical field is not empty
            if ($request->chief_complaint || $request->findings || $request->diagnosis || $request->treatment_plan) {
                $recordVetId = $request->vet_id;
                if (!$recordVetId) {
                    $user = auth()->user();
                    if ($user && $user->role === \App\Enums\Roles::VETERINARIAN->value) {
                        $recordVetId = $user->id;
                    }
                }

                $pet->medicalRecords()->create([
                    'chief_complaint' => $request->chief_complaint,
                    'findings'        => $request->findings,
                    'diagnosis'       => $request->diagnosis,
                    'treatment_plan'  => $request->treatment_plan,
                    'notes'           => $request->notes,
                    'vet_id'          => $recordVetId,
                ]);
            }
        }

        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory'])
            ->append(['total_paid', 'total_due', 'last_visit', 'next_due']));
    }

    public function destroy(Pet $pet)
    {
        $user = auth()->user();
        if (
            (method_exists($user, 'isAdmin') && !$user->isAdmin()) && 
            (method_exists($user, 'isClinical') && !$user->isClinical())
        ) {
            return response()->json(['message' => 'Unauthorized. Only Admins and Veterinarians can archive patient records.'], 403);
        }

        $pet->delete();
        return response()->json(null, 204);
    }
}

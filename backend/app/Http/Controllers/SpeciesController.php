<?php

namespace App\Http\Controllers;

use App\Models\Species;
use Illuminate\Http\Request;

class SpeciesController extends Controller
{
    public function index(Request $request)
    {
        $query = Species::with('breeds.defaultSizeCategory');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $sortBy = $request->get('sort_by', 'name');
        $sortDirection = $request->get('sort_direction', 'asc');
        $query->orderBy($sortBy, $sortDirection);

        return response()->json($query->paginate($request->get('per_page', 10)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:species',
            'status' => 'nullable|string'
        ]);

        $species = Species::create($validated);
        return response()->json($species, 201);
    }

    public function show(Species $species)
    {
        return response()->json($species->load('breeds'));
    }

    public function update(Request $request, Species $species)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:species,name,' . $species->id,
            'status' => 'nullable|string'
        ]);

        $species->update($validated);
        return response()->json($species);
    }

    public function destroy(Species $species)
    {
        // Don't delete if it has breeds or pets... but we can just rely on cascade or throw error.
        $species->delete();
        return response()->json(null, 204);
    }
}

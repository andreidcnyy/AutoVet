<?php

namespace App\Http\Controllers;

use App\Models\Breed;
use Illuminate\Http\Request;

class BreedController extends Controller
{
    public function index(Request $request)
    {
        $query = Breed::with(['species', 'defaultSizeCategory']);
        
        if ($request->has('species_id')) {
            $query->where('species_id', $request->species_id);
        }

        if ($request->has('search')) {
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
            'species_id' => 'required|exists:species,id',
            'default_size_category_id' => 'nullable|exists:pet_size_categories,id',
            'name' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $breed = Breed::create($validated);
        return response()->json($breed->load(['species', 'defaultSizeCategory']), 201);
    }

    public function show(Breed $breed)
    {
        return response()->json($breed->load(['species', 'defaultSizeCategory']));
    }

    public function update(Request $request, Breed $breed)
    {
        $validated = $request->validate([
            'species_id' => 'required|exists:species,id',
            'default_size_category_id' => 'nullable|exists:pet_size_categories,id',
            'name' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $breed->update($validated);
        return response()->json($breed->load(['species', 'defaultSizeCategory']));
    }

    public function destroy(Breed $breed)
    {
        $breed->delete();
        return response()->json(null, 204);
    }
}

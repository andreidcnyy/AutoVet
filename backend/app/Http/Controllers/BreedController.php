<?php

namespace App\Http\Controllers;

use App\Models\Breed;
use App\Support\ListQuery;
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
            $query->where('name', 'like', ListQuery::contains($request->search));
        }

        [$sortBy, $sortDirection] = ListQuery::sort($request, ['id', 'name', 'status', 'created_at', 'updated_at', 'species_id'], 'name');
        $query->orderBy($sortBy, $sortDirection)->orderBy('id');

        // Lookup table: screens load it whole into dropdowns, so the ceiling
        // is higher than for paged lists, but there is one.
        return response()->json($query->paginate(ListQuery::perPage($request, 10, ListQuery::MAX_LOOKUP_PER_PAGE)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'species_id' => 'required|clinic_exists:species,id',
            'default_size_category_id' => 'nullable|clinic_exists:pet_size_categories,id',
            'name' => 'required|string',
            'status' => 'nullable|string',
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
            'species_id' => 'required|clinic_exists:species,id',
            'default_size_category_id' => 'nullable|clinic_exists:pet_size_categories,id',
            'name' => 'required|string',
            'status' => 'nullable|string',
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

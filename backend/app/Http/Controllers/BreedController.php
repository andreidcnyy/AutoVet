<?php

namespace App\Http\Controllers;

use App\Models\Breed;
use Illuminate\Http\Request;

class BreedController extends Controller
{
    public function index(Request $request)
    {
        $query = Breed::with('species');
        if ($request->has('species_id')) {
            $query->where('species_id', $request->species_id);
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'species_id' => 'required|exists:species,id',
            'name' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $breed = Breed::create($validated);
        return response()->json($breed->load('species'), 201);
    }

    public function show(Breed $breed)
    {
        return response()->json($breed->load('species'));
    }

    public function update(Request $request, Breed $breed)
    {
        $validated = $request->validate([
            'species_id' => 'required|exists:species,id',
            'name' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $breed->update($validated);
        return response()->json($breed->load('species'));
    }

    public function destroy(Breed $breed)
    {
        $breed->delete();
        return response()->json(null, 204);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\UnitOfMeasure;
use Illuminate\Http\Request;

class UnitOfMeasureController extends Controller
{
    public function index(Request $request)
    {
        $query = UnitOfMeasure::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%')
                  ->orWhere('abbreviation', 'like', '%' . $request->search . '%');
        }

        $sortBy = $request->get('sort_by', 'name');
        $sortDirection = $request->get('sort_direction', 'asc');
        $query->orderBy($sortBy, $sortDirection);

        return response()->json($query->paginate($request->get('per_page', 10)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:units_of_measure',
            'abbreviation' => 'required|string|unique:units_of_measure',
            'status' => 'nullable|string'
        ]);

        $unit = UnitOfMeasure::create($validated);
        return response()->json($unit, 201);
    }

    /**
     * The route for this exists via apiResource, so without the method
     * the request reached Laravel's router and died with a
     * BadMethodCallException, surfacing to the client as a 500.
     */
    public function show(UnitOfMeasure $unitOfMeasure)
    {
        return response()->json($unitOfMeasure);
    }

    public function update(Request $request, UnitOfMeasure $unitOfMeasure)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:units_of_measure,name,' . $unitOfMeasure->id,
            'abbreviation' => 'required|string|unique:units_of_measure,abbreviation,' . $unitOfMeasure->id,
            'status' => 'nullable|string'
        ]);

        $unitOfMeasure->update($validated);
        return response()->json($unitOfMeasure);
    }

    public function destroy(UnitOfMeasure $unitOfMeasure)
    {
        $unitOfMeasure->delete();
        return response()->json(null, 204);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\UnitOfMeasure;
use App\Support\ListQuery;
use Illuminate\Http\Request;

class UnitOfMeasureController extends Controller
{
    public function index(Request $request)
    {
        $query = UnitOfMeasure::query();

        if ($request->filled('search')) {
            // Grouped so the OR cannot widen any other condition on the query.
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', ListQuery::contains($request->search))
                    ->orWhere('abbreviation', 'like', ListQuery::contains($request->search));
            });
        }

        [$sortBy, $sortDirection] = ListQuery::sort($request, ['id', 'name', 'status', 'created_at', 'updated_at', 'abbreviation'], 'name');
        $query->orderBy($sortBy, $sortDirection)->orderBy('id');

        // Lookup table: screens load it whole into dropdowns, so the ceiling
        // is higher than for paged lists, but there is one.
        return response()->json($query->paginate(ListQuery::perPage($request, 10, ListQuery::MAX_LOOKUP_PER_PAGE)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:units_of_measure',
            'abbreviation' => 'required|string|unique:units_of_measure',
            'status' => 'nullable|string',
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
            'name' => 'required|string|unique:units_of_measure,name,'.$unitOfMeasure->id,
            'abbreviation' => 'required|string|unique:units_of_measure,abbreviation,'.$unitOfMeasure->id,
            'status' => 'nullable|string',
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

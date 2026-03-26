<?php

namespace App\Http\Controllers;

use App\Models\WeightRange;
use Illuminate\Http\Request;

class WeightRangeController extends Controller
{
    public function index(Request $request)
    {
        $query = WeightRange::query();

        if ($request->has('search')) {
            $query->where('label', 'like', '%' . $request->search . '%');
        }

        $sortBy = $request->get('sort_by', 'min_weight');
        $sortDirection = $request->get('sort_direction', 'asc');
        $query->orderBy($sortBy, $sortDirection);

        return response()->json($query->paginate($request->get('per_page', 10)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'label' => 'required|string',
            'min_weight' => 'required|numeric',
            'max_weight' => 'nullable|numeric|gte:min_weight',
            'unit' => 'required|string',
            'status' => 'nullable|string'
        ]);

        // Basic overlap check could be added here or as a custom validation rule
        
        $range = WeightRange::create($validated);
        return response()->json($range, 201);
    }

    public function update(Request $request, WeightRange $weightRange)
    {
        $validated = $request->validate([
            'label' => 'required|string',
            'min_weight' => 'required|numeric',
            'max_weight' => 'nullable|numeric|gte:min_weight',
            'unit' => 'required|string',
            'status' => 'nullable|string'
        ]);

        $weightRange->update($validated);
        return response()->json($weightRange);
    }

    public function destroy(WeightRange $weightRange)
    {
        $weightRange->delete();
        return response()->json(null, 204);
    }
}

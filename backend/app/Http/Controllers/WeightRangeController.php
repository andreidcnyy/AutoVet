<?php

namespace App\Http\Controllers;

use App\Models\WeightRange;
use Illuminate\Http\Request;

class WeightRangeController extends Controller
{
    public function index(Request $request)
    {
        $query = WeightRange::with(['sizeCategory', 'species']);

        if ($request->has('species_id')) {
            $query->where('species_id', $request->species_id);
        }

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
            'species_id' => 'required|exists:species,id',
            'min_weight' => 'required|numeric|min:0',
            'max_weight' => 'nullable|numeric|gt:min_weight',
            'unit' => 'required|string',
            'size_category_id' => 'required|exists:pet_size_categories,id',
            'status' => 'required|string'
        ]);

        if ($this->hasOverlap($validated)) {
            return response()->json([
                'message' => 'The weight range overlaps with an existing active range for this species and unit.',
                'errors' => ['min_weight' => ['Range overlap detected.']]
            ], 422);
        }
        
        $range = WeightRange::create($validated);
        return response()->json($range->load(['sizeCategory', 'species']), 201);
    }

    public function update(Request $request, WeightRange $weightRange)
    {
        $validated = $request->validate([
            'label' => 'required|string',
            'species_id' => 'required|exists:species,id',
            'min_weight' => 'required|numeric|min:0',
            'max_weight' => 'nullable|numeric|gt:min_weight',
            'unit' => 'required|string',
            'size_category_id' => 'required|exists:pet_size_categories,id',
            'status' => 'required|string'
        ]);

        if ($this->hasOverlap($validated, $weightRange->id)) {
            return response()->json([
                'message' => 'The weight range overlaps with an existing active range for this species and unit.',
                'errors' => ['min_weight' => ['Range overlap detected.']]
            ], 422);
        }

        $weightRange->update($validated);
        return response()->json($weightRange->load(['sizeCategory', 'species']));
    }

    private function hasOverlap($data, $excludeId = null)
    {
        if ($data['status'] !== 'Active') {
            return false;
        }

        $query = WeightRange::where('species_id', $data['species_id'])
            ->where('unit', $data['unit'])
            ->where('status', 'Active');

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        $newMin = $data['min_weight'];
        $newMax = $data['max_weight'];

        return $query->where(function($q) use ($newMin, $newMax) {
            $q->where(function($sq) use ($newMax) {
                if ($newMax !== null) {
                    $sq->where('min_weight', '<', $newMax);
                }
            })->where(function($sq) use ($newMin) {
                $sq->whereNull('max_weight')
                   ->orWhere('max_weight', '>', $newMin);
            });
        })->exists();
    }

    public function destroy(WeightRange $weightRange)
    {
        $weightRange->delete();
        return response()->json(null, 204);
    }
}

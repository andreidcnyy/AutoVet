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
            'max_weight' => 'nullable|numeric|gte:min_weight',
            'unit' => 'required|string',
            'size_category_id' => 'required|exists:pet_size_categories,id',
            'status' => 'required|string'
        ]);

        if ($validated['status'] === 'Active') {
            $overlap = $this->checkOverlap($validated['species_id'], $validated['unit'], $validated['min_weight'], $validated['max_weight']);
            if ($overlap) {
                return response()->json(['message' => 'This weight range overlaps with an existing active range for this species.'], 422);
            }
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
            'max_weight' => 'nullable|numeric|gte:min_weight',
            'unit' => 'required|string',
            'size_category_id' => 'required|exists:pet_size_categories,id',
            'status' => 'required|string'
        ]);

        if ($validated['status'] === 'Active') {
            $overlap = $this->checkOverlap($validated['species_id'], $validated['unit'], $validated['min_weight'], $validated['max_weight'], $weightRange->id);
            if ($overlap) {
                return response()->json(['message' => 'This weight range overlaps with an existing active range for this species.'], 422);
            }
        }

        $weightRange->update($validated);
        return response()->json($weightRange->load(['sizeCategory', 'species']));
    }

    private function checkOverlap($speciesId, $unit, $min, $max, $excludeId = null)
    {
        return WeightRange::where('species_id', $speciesId)
            ->where('unit', $unit)
            ->where('status', 'Active')
            ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
            ->where(function ($query) use ($min, $max) {
                // Two ranges [min1, max1] and [min2, max2] overlap if:
                // min1 < max2 AND max1 > min2 (treating null max as infinity)
                
                $query->where(function ($q) use ($max) {
                    $q->whereNull('max_weight') // max2 is infinity
                      ->orWhere('min_weight', '<', $max ?: 999999); // max1 is infinity if $max null
                      // Wait, if $max is null, min_weight < infinity is always true.
                      if ($max === null) {
                          $q->whereRaw('1=1');
                      } else {
                          $q->where('min_weight', '<', $max);
                      }
                })->where(function ($q) use ($min) {
                    $q->whereNull('max_weight') // max2 is infinity, infinity > min1 always true
                      ->orWhere('max_weight', '>', $min);
                });
            })
            ->exists();
    }

    public function destroy(WeightRange $weightRange)
    {
        $weightRange->delete();
        return response()->json(null, 204);
    }
}

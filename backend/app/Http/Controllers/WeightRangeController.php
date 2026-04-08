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

        if ($conflict = $this->findConflict($validated)) {
            return response()->json([
                'message' => $this->formatConflictMessage($conflict),
                'errors' => ['min_weight' => ['Range overlap detected.']]
            ], 422);
        }
        
        $range = WeightRange::create($validated);
        return response()->json($range->load(['sizeCategory', 'species']), 201);
    }

    public function update(Request $request, $id)
    {
        $weightRange = WeightRange::findOrFail($id);

        \Log::info('WeightRangeController@update', [
            'id' => $id,
            'model_id' => $weightRange->id,
            'request_data' => $request->all()
        ]);

        $validated = $request->validate([
            'label' => 'required|string',
            'species_id' => 'required|exists:species,id',
            'min_weight' => 'required|numeric|min:0',
            'max_weight' => 'nullable|numeric|gt:min_weight',
            'unit' => 'required|string',
            'size_category_id' => 'required|exists:pet_size_categories,id',
            'status' => 'required|string'
        ]);

        if ($conflict = $this->findConflict($validated, $weightRange->id)) {
            \Log::warning('Conflict detected during update', [
                'exclude_id' => $weightRange->id,
                'conflict_id' => $conflict->id,
                'conflict_label' => $conflict->label
            ]);
            
            // Final safety check: if for some reason the query still returned the same record
            if ($conflict->id == $weightRange->id) {
                \Log::error('CRITICAL: findConflict returned the excluded ID despite where clause.');
                $weightRange->update($validated);
                return response()->json($weightRange->load(['sizeCategory', 'species']));
            }

            return response()->json([
                'message' => $this->formatConflictMessage($conflict),
                'errors' => ['min_weight' => ['Range overlap detected.']]
            ], 422);
        }

        $weightRange->update($validated);
        return response()->json($weightRange->load(['sizeCategory', 'species']));
    }

    private function findConflict($data, $excludeId = null)
    {
        \Log::debug('WeightRangeController@findConflict', [
            'exclude_id' => $excludeId,
            'species_id' => $data['species_id'] ?? null,
            'unit' => $data['unit'] ?? null
        ]);

        if ($data['status'] !== 'Active') {
            return null;
        }

        $query = WeightRange::with(['sizeCategory', 'species'])
            ->where('species_id', $data['species_id'])
            ->where('unit', $data['unit'])
            ->where('status', 'Active');

        if ($excludeId !== null) {
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
        })->first();
    }

    private function formatConflictMessage($conflict)
    {
        $min = number_format($conflict->min_weight, 2);
        $max = $conflict->max_weight === null ? '∞' : number_format($conflict->max_weight, 2);
        $size = $conflict->sizeCategory?->name ?? 'Unlinked';
        $species = $conflict->species?->name ?? 'Unknown';
        
        return "Conflicts with existing {$species} range: {$min} - {$max} ({$size})";
    }

    public function destroy(WeightRange $weightRange)
    {
        $weightRange->delete();
        return response()->json(null, 204);
    }
}

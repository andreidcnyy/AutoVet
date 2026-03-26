<?php

namespace App\Http\Controllers;

use App\Models\PetSizeCategory;
use Illuminate\Http\Request;

class PetSizeCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = PetSizeCategory::query();

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
            'name' => 'required|string|unique:pet_size_categories',
            'description' => 'nullable|string',
            'status' => 'nullable|string'
        ]);

        $category = PetSizeCategory::create($validated);
        return response()->json($category, 201);
    }

    public function update(Request $request, PetSizeCategory $petSizeCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:pet_size_categories,name,' . $petSizeCategory->id,
            'description' => 'nullable|string',
            'status' => 'nullable|string'
        ]);

        $petSizeCategory->update($validated);
        return response()->json($petSizeCategory);
    }

    public function destroy(PetSizeCategory $petSizeCategory)
    {
        $petSizeCategory->delete();
        return response()->json(null, 204);
    }
}

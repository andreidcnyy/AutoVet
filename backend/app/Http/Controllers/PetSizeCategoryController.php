<?php

namespace App\Http\Controllers;

use App\Models\PetSizeCategory;
use App\Support\ListQuery;
use Illuminate\Http\Request;

class PetSizeCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = PetSizeCategory::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', ListQuery::contains($request->search));
        }

        [$sortBy, $sortDirection] = ListQuery::sort($request, ['id', 'name', 'status', 'created_at', 'updated_at'], 'name');
        $query->orderBy($sortBy, $sortDirection)->orderBy('id');

        // Lookup table: screens load it whole into dropdowns, so the ceiling
        // is higher than for paged lists, but there is one.
        return response()->json($query->paginate(ListQuery::perPage($request, 10, ListQuery::MAX_LOOKUP_PER_PAGE)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:pet_size_categories',
            'description' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        $category = PetSizeCategory::create($validated);

        return response()->json($category, 201);
    }

    /**
     * The route for this exists via apiResource, so without the method
     * the request reached Laravel's router and died with a
     * BadMethodCallException, surfacing to the client as a 500.
     */
    public function show(PetSizeCategory $petSizeCategory)
    {
        return response()->json($petSizeCategory);
    }

    public function update(Request $request, PetSizeCategory $petSizeCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:pet_size_categories,name,'.$petSizeCategory->id,
            'description' => 'nullable|string',
            'status' => 'nullable|string',
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

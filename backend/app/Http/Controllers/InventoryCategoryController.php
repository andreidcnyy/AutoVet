<?php

namespace App\Http\Controllers;

use App\Models\InventoryCategory;
use App\Support\ListQuery;
use Illuminate\Http\Request;

class InventoryCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryCategory::query();

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
            'name' => 'required|string|unique:mdm_inventory_categories',
            'status' => 'nullable|string',
        ]);

        $category = InventoryCategory::create($validated);

        return response()->json($category, 201);
    }

    /**
     * The route for this exists via apiResource, so without the method
     * the request reached Laravel's router and died with a
     * BadMethodCallException, surfacing to the client as a 500.
     */
    public function show(InventoryCategory $inventoryCategory)
    {
        return response()->json($inventoryCategory);
    }

    public function update(Request $request, InventoryCategory $inventoryCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:mdm_inventory_categories,name,'.$inventoryCategory->id,
            'status' => 'nullable|string',
        ]);

        $inventoryCategory->update($validated);

        return response()->json($inventoryCategory);
    }

    public function destroy(InventoryCategory $inventoryCategory)
    {
        $inventoryCategory->delete();

        return response()->json(null, 204);
    }
}

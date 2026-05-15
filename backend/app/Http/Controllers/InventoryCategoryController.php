<?php

namespace App\Http\Controllers;

use App\Models\InventoryCategory;
use Illuminate\Http\Request;

class InventoryCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryCategory::query();

        if ($request->filled('search')) {
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
            'name' => 'required|string|unique:mdm_inventory_categories',
            'status' => 'nullable|string'
        ]);

        $category = InventoryCategory::create($validated);
        return response()->json($category, 201);
    }

    public function update(Request $request, InventoryCategory $inventoryCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:mdm_inventory_categories,name,' . $inventoryCategory->id,
            'status' => 'nullable|string'
        ]);

        $inventoryCategory->update($validated);
        return response()->json($inventoryCategory);
    }

    public function destroy(InventoryCategory $inventoryCategory)
    {
        $linkedCount = \App\Models\Inventory::where('inventory_category_id', $inventoryCategory->id)->count();
        if ($linkedCount > 0) {
            return response()->json([
                'message' => "Cannot delete \"{$inventoryCategory->name}\" — it is used by {$linkedCount} inventory item(s). Reassign or delete those items first."
            ], 422);
        }

        $inventoryCategory->delete();
        return response()->json(null, 204);
    }
}

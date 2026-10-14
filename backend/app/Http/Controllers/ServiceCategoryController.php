<?php

namespace App\Http\Controllers;

use App\Models\ServiceCategory;
use Illuminate\Http\Request;

class ServiceCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = ServiceCategory::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', \App\Support\ListQuery::contains($request->search));
        }

        [$sortBy, $sortDirection] = \App\Support\ListQuery::sort($request, ['id', 'name', 'status', 'created_at', 'updated_at'], 'name');
        $query->orderBy($sortBy, $sortDirection)->orderBy('id');

        // Lookup table: screens load it whole into dropdowns, so the ceiling
        // is higher than for paged lists, but there is one.
        return response()->json($query->paginate(\App\Support\ListQuery::perPage($request, 10, \App\Support\ListQuery::MAX_LOOKUP_PER_PAGE)));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:mdm_service_categories',
            'status' => 'nullable|string'
        ]);

        $category = ServiceCategory::create($validated);
        return response()->json($category, 201);
    }

    /**
     * The route for this exists via apiResource, so without the method
     * the request reached Laravel's router and died with a
     * BadMethodCallException, surfacing to the client as a 500.
     */
    public function show(ServiceCategory $serviceCategory)
    {
        return response()->json($serviceCategory);
    }

    public function update(Request $request, ServiceCategory $serviceCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:mdm_service_categories,name,' . $serviceCategory->id,
            'status' => 'nullable|string'
        ]);

        $serviceCategory->update($validated);
        return response()->json($serviceCategory);
    }

    public function destroy(ServiceCategory $serviceCategory)
    {
        $serviceCategory->delete();
        return response()->json(null, 204);
    }
}

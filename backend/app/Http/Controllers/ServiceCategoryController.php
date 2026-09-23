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

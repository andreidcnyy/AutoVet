<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(\App\Models\Service::with('sizePrices')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
        ]);

        $service = \App\Models\Service::create($validated);
        return response()->json($service, 201);
    }

    public function show(string $id)
    {
        $service = \App\Models\Service::with('sizePrices')->findOrFail($id);
        return response()->json($service);
    }

    public function update(Request $request, string $id)
    {
        $service = \App\Models\Service::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
        ]);

        $service->update($validated);
        return response()->json($service);
    }

    public function destroy(string $id)
    {
        $service = \App\Models\Service::findOrFail($id);
        $service->delete();
        return response()->json(null, 204);
    }
}

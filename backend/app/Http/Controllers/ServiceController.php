<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json(\App\Models\Service::with(['sizePrices', 'pricingRules'])->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'pricing_type' => 'required|string|in:fixed,size_based,weight_based',
            'measurement_basis' => 'required|string|in:none,size,weight',
            'base_price' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
            'pricing_rules' => 'nullable|array',
            'pricing_rules.*.basis_type' => 'required|string|in:size,weight',
            'pricing_rules.*.reference_id' => 'required|integer',
            'pricing_rules.*.price' => 'required|numeric|min:0',
        ]);

        $service = \App\Models\Service::create($validated);

        if (!empty($validated['pricing_rules'])) {
            $service->pricingRules()->createMany($validated['pricing_rules']);
        }

        return response()->json($service->load('pricingRules'), 201);
    }

    public function show(string $id)
    {
        $service = \App\Models\Service::with(['sizePrices', 'pricingRules'])->findOrFail($id);
        return response()->json($service);
    }

    public function update(Request $request, string $id)
    {
        $service = \App\Models\Service::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'pricing_type' => 'nullable|string|in:fixed,size_based,weight_based',
            'measurement_basis' => 'nullable|string|in:none,size,weight',
            'base_price' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:Active,Inactive',
            'pricing_rules' => 'nullable|array',
            'pricing_rules.*.basis_type' => 'required|string|in:size,weight',
            'pricing_rules.*.reference_id' => 'required|integer',
            'pricing_rules.*.price' => 'required|numeric|min:0',
        ]);

        $service->update($validated);

        if (isset($validated['pricing_rules'])) {
            $service->pricingRules()->delete();
            $service->pricingRules()->createMany($validated['pricing_rules']);
        }

        return response()->json($service->load('pricingRules'));
    }

    public function destroy(string $id)
    {
        $service = \App\Models\Service::findOrFail($id);
        $service->delete();
        return response()->json(null, 204);
    }
}

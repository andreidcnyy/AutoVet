<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Inventory;

class InventoryController extends Controller
{
    public function index()
    {
        return response()->json(Inventory::all());
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'item_name' => 'required|string|max:255',
            'sub_details' => 'nullable|string|max:255',
            'category' => 'required|string|max:255',
            'sku' => 'required|string|unique:inventories,sku|max:255',
            'stock_level' => 'required|integer|min:0',
            'status' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date',
        ]);

        $item = Inventory::create($validatedData);

        return response()->json($item, 201);
    }

    public function destroy(Inventory $inventory)
    {
        $inventory->delete();
        return response()->json(null, 204);
    }
}

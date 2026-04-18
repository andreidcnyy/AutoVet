<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\Admin;
use App\Jobs\RefreshInventoryForecast;
use App\Traits\HasInternalNotifications;

class InventoryController extends Controller
{
    use HasInternalNotifications;

    protected $skuGenerator;

    public function __construct(\App\Services\SkuGeneratorService $skuGenerator)
    {
        $this->skuGenerator = $skuGenerator;
    }

    public function index()
    {
        return response()->json(Inventory::with(['inventoryCategory', 'latestForecast'])->get());
    }

    public function lowStock(Request $request)
    {
        $lowStockItems = Inventory::whereRaw('stock_level <= min_stock_level')->get();
        return response()->json($lowStockItems);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'item_name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'sub_details' => 'nullable|string|max:255',
            'inventory_category_id' => 'required|exists:mdm_inventory_categories,id',
            'stock_level' => 'required|integer|min:0',
            'min_stock_level' => 'required|integer|min:0',
            'status' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date',
            'is_billable' => 'boolean',
            'is_consumable' => 'boolean',
            'deduct_on_finalize' => 'boolean',
        ]);

        // Automatically generate SKU by resolving the category name
        $categoryRecord = \App\Models\InventoryCategory::find($validatedData['inventory_category_id']);
        $validatedData['sku'] = $this->skuGenerator->generate(
            $categoryRecord->name ?? 'UNK',
            $validatedData['item_name'],
            $validatedData['sub_details']
        );

        if (array_key_exists('price', $validatedData)) {
            $validatedData['cost_price'] = $validatedData['price'];
            unset($validatedData['price']);
        }
        if (array_key_exists('is_billable', $validatedData)) {
            $validatedData['is_sellable'] = $validatedData['is_billable'];
            unset($validatedData['is_billable']);
        }
        if (array_key_exists('is_consumable', $validatedData)) {
            $validatedData['is_service_usable'] = $validatedData['is_consumable'];
            unset($validatedData['is_consumable']);
        }

        $item = Inventory::create($validatedData);

        if ($item->stock_level > 0) {
            InventoryTransaction::create([
                'inventory_id' => $item->id,
                'transaction_type' => 'Stock In',
                'quantity' => $item->stock_level,
                'previous_stock' => 0,
                'new_stock' => $item->stock_level,
                'remarks' => 'Initial Stock',
                'created_by' => auth()->id() ?? (Admin::first()->id ?? null)
            ]);

            // Internal admin notification for initial stock
            $this->createInternalNotification(
                'StockAdjustment',
                'New Stock Added',
                "Initial stock of {$item->stock_level} units added for '{$item->item_name}'.",
                ['inventory_id' => $item->id]
            );
        }

        // Trigger initial forecast refresh (Part 1.2)
        RefreshInventoryForecast::dispatch([$item->id], 'manual');

        return response()->json($item->load('inventoryCategory'), 201);
    }

    public function update(Request $request, Inventory $inventory)
    {
        $validatedData = $request->validate([
            'item_name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'sub_details' => 'nullable|string|max:255',
            'inventory_category_id' => 'required|exists:mdm_inventory_categories,id',
            'sku' => 'required|string|max:255|unique:inventories,sku,' . $inventory->id,
            'stock_level' => 'required|integer|min:0',
            'min_stock_level' => 'required|integer|min:0',
            'status' => 'required|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date',
            'is_billable' => 'boolean',
            'is_consumable' => 'boolean',
            'deduct_on_finalize' => 'boolean',
        ]);

        $oldStock = $inventory->stock_level;
        $newStock = $validatedData['stock_level'];

        if (array_key_exists('price', $validatedData)) {
            $validatedData['cost_price'] = $validatedData['price'];
            unset($validatedData['price']);
        }
        if (array_key_exists('is_billable', $validatedData)) {
            $validatedData['is_sellable'] = $validatedData['is_billable'];
            unset($validatedData['is_billable']);
        }
        if (array_key_exists('is_consumable', $validatedData)) {
            $validatedData['is_service_usable'] = $validatedData['is_consumable'];
            unset($validatedData['is_consumable']);
        }

        $inventory->update($validatedData);

        if ($oldStock != $newStock) {
            $qtyDiff = $newStock - $oldStock;
            InventoryTransaction::create([
                'inventory_id' => $inventory->id,
                'transaction_type' => 'Adjustment',
                'quantity' => $qtyDiff,
                'previous_stock' => $oldStock,
                'new_stock' => $newStock,
                'remarks' => 'Manual adjustment via UI',
                'created_by' => auth()->id() ?? (Admin::first()->id ?? null)
            ]);

            // Internal admin notification for stock adjustment
            if ($qtyDiff > 0) {
                $this->createInternalNotification(
                    'StockAdjustment',
                    'Stock Increased',
                    "Stock level for '{$inventory->item_name}' was manually increased by {$qtyDiff} units.",
                    ['inventory_id' => $inventory->id]
                );
            } else {
                $this->createInternalNotification(
                    'StockAdjustment',
                    'Stock Decreased',
                    "Stock level for '{$inventory->item_name}' was manually decreased by " . abs($qtyDiff) . " units.",
                    ['inventory_id' => $inventory->id]
                );
            }

            // Trigger forecast refresh when stock level changes (Part 1.2)
            RefreshInventoryForecast::dispatch([$inventory->id], 'stock_update');
        }

        return response()->json($inventory->load('inventoryCategory'));
    }

    public function destroy(Inventory $inventory)
    {
        $inventory->delete();
        return response()->json(null, 204);
    }

    public function transactions(Inventory $inventory)
    {
        $transactions = $inventory->transactions()->with('creator:id,name')->orderBy('created_at', 'desc')->get();
        return response()->json($transactions);
    }

    /**
     * Accepts an AI forecast recommendation to update the minimum stock level of an inventory item.
     *
     * @param \Illuminate\Http\Request $request
     * @param \App\Models\Inventory $inventory
     * @return \Illuminate\Http\JsonResponse
     */
    public function acceptForecastRecommendation(Request $request, Inventory $inventory)
    {
        $validatedData = $request->validate([
            'new_min_stock_level' => 'required|integer|min:0',
        ]);

        $oldMinStockLevel = $inventory->min_stock_level;
        $inventory->min_stock_level = $validatedData['new_min_stock_level'];
        $inventory->save();

        \Illuminate\Support\Facades\Log::info("Inventory {$inventory->id}: min_stock_level updated from {$oldMinStockLevel} to {$inventory->min_stock_level} based on AI forecast.", [
            'inventory_id' => $inventory->id,
            'old_min_stock_level' => $oldMinStockLevel,
            'new_min_stock_level' => $inventory->min_stock_level,
            'user_id' => auth()->id(),
        ]);

        return response()->json($inventory->load('inventoryCategory'));
    }
}

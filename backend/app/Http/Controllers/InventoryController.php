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
        $inventory = Inventory::with(['inventoryCategory', 'latestForecast'])->get();
// Recalculate forecast days/status based on real-time stock and monthly needs
$daysInMonth = \Carbon\Carbon::now()->daysInMonth;
$dayOfMonth = \Carbon\Carbon::now()->day;
$daysRemaining = $daysInMonth - $dayOfMonth + 1; // Remaining days including today

$inventory->each(function ($item) use ($daysRemaining) {
    if ($item->latestForecast) {
        $avgDaily = (float) ($item->latestForecast->average_daily_consumption ?? 0);
        $currentStock = (float) $item->stock_level;
        $minStock = (float) ($item->min_stock_level ?? 0);

        if ($avgDaily > 0) {
            $daysLeft = ($currentStock > $minStock) ? ceil(($currentStock - $minStock) / $avgDaily) : 0;
            $item->latestForecast->days_until_stockout = (int)$daysLeft;

            // NEW PREDICTIVE LOGIC:
            // If predicted needs for the rest of the month exceed current stock, mark as Critical
            $projectedMonthlyNeed = $avgDaily * $daysRemaining;

            if ($currentStock < $projectedMonthlyNeed || $daysLeft < 7) {
                $item->latestForecast->forecast_status = 'Low Stock';
            } elseif ($daysLeft < 14) {
                $item->latestForecast->forecast_status = 'Reorder Soon';
            } else {
                $item->latestForecast->forecast_status = 'Safe';
            }
        }
    }
});
        return response()->json($inventory);
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
            'price' => 'required|numeric|min:0', 
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date', // Optional again
        ]);

        // Automatically generate SKU by resolving the category name
        $categoryRecord = \App\Models\InventoryCategory::find($validatedData['inventory_category_id']);
        $validatedData['sku'] = $this->skuGenerator->generate(
            $categoryRecord->name ?? 'UNK',
            $validatedData['item_name'],
            $validatedData['sub_details']
        );

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
            'price' => 'required|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'expiration_date' => 'nullable|date',
        ]);

        $oldStock = $inventory->stock_level;
        $newStock = $validatedData['stock_level'];

        $inventory->update($validatedData);

        if ($oldStock != $newStock) {
            $qtyDiff = $newStock - $oldStock;
            \App\Models\InventoryTransaction::create([
                'inventory_id' => $inventory->id,
                'transaction_type' => 'Adjustment',
                'quantity' => $qtyDiff,
                'previous_stock' => $oldStock,
                'new_stock' => $newStock,
                'remarks' => 'Manual adjustment via UI',
                'created_by' => auth()->id() ?? (\App\Models\Admin::first()->id ?? null)
            ]);

            // If it's a decrease, log into usage history for AI learning
            if ($qtyDiff < 0) {
                \App\Models\InventoryUsageHistory::create([
                    'inventory_id' => $inventory->id,
                    'quantity_used' => abs($qtyDiff),
                    'usage_date' => now()->toDateString(),
                    'source_type' => 'manual_adjustment',
                    'unit_price' => $inventory->selling_price
                ]);
                
                // Clear AI forecast reorder suggestions if item just became out of stock
                if ($newStock <= 0) {
                    \App\Models\InventoryForecast::where('inventory_id', $inventory->id)->update(['forecast_status' => 'Out of Stock']);
                }
            }

            // Internal admin notification for stock adjustment
            $this->createInternalNotification(
                'StockAdjustment',
                'Inventory Adjusted',
                "Stock for '{$inventory->item_name}' was manually adjusted from {$oldStock} to {$newStock}. New Status: " . $inventory->calculateStockStatus(),
                ['inventory_id' => $inventory->id]
            );
            }

            // Trigger initial forecast refresh (Part 1.2)
            \App\Jobs\RefreshInventoryForecast::dispatch([$inventory->id], 'manual');

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

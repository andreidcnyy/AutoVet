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
        Inventory::applyLiveForecasts($inventory);
        return response()->json($inventory);
    }

    public function lowStock(Request $request)
    {
        $lowStockItems = Inventory::whereRaw('stock_level <= min_stock_level')->get();
        return response()->json($lowStockItems);
    }

    public function batchLotOptions()
    {
        $batches = Inventory::whereNotNull('batch_number')
            ->where('batch_number', '!=', '')
            ->distinct()
            ->pluck('batch_number')
            ->values();

        $lots = Inventory::whereNotNull('lot_number')
            ->where('lot_number', '!=', '')
            ->distinct()
            ->pluck('lot_number')
            ->values();

        return response()->json(['batch_numbers' => $batches, 'lot_numbers' => $lots]);
    }

    public function show(Inventory $inventory)
    {
        return response()->json($inventory->load('inventoryCategory'));
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
            'expiration_date' => 'nullable|date',
            'lot_number'      => 'nullable|string|max:100',
            'batch_number'    => 'nullable|string|max:100',
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
            'lot_number'      => 'nullable|string|max:100',
            'batch_number'    => 'nullable|string|max:100',
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

                // Fire low stock alert if stock has dropped to or below threshold
                if ($newStock <= $inventory->min_stock_level) {
                    event(new \App\Events\LowStockDetected($inventory));
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

    /**
     * Receive a new delivery of an existing product.
     *
     * Unlike update(), which overwrites the stock level of the row it is given,
     * this creates a *new* row sharing the product's code. Rows sharing a code
     * are the batches that InvoiceFinalizationService consumes oldest-first, so
     * this is what puts real data behind the FIFO deduction.
     */
    public function receiveStock(Request $request, Inventory $inventory)
    {
        $validated = $request->validate([
            'quantity'        => 'required|integer|min:1',
            'batch_number'    => 'required|string|max:100',
            'lot_number'      => 'nullable|string|max:100',
            'expiration_date' => 'nullable|date',
            'price'           => 'nullable|numeric|min:0',
            'selling_price'   => 'nullable|numeric|min:0',
            'supplier'        => 'nullable|string|max:255',
            'remarks'         => 'nullable|string|max:255',
        ]);

        $batch = \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $inventory) {
            $product = Inventory::where('id', $inventory->id)->lockForUpdate()->first();

            // FIFO groups batches by code, so a product without one can never
            // accumulate batches. Backfill from the SKU before branching.
            if (empty($product->code)) {
                $product->code = $product->sku;
                $product->save();
            }

            $categoryName = \App\Models\InventoryCategory::find($product->inventory_category_id)->name ?? 'UNK';

            $batch = Inventory::create([
                // Inherit the product's clinic rather than the actor's, so a
                // batch always belongs to the same clinic as the stock it joins.
                'clinic_id'             => $product->clinic_id,
                'item_name'             => $product->item_name,
                'code'                  => $product->code,
                'sub_details'           => $product->sub_details,
                'inventory_category_id' => $product->inventory_category_id,
                'sku'                   => $this->skuGenerator->generate(
                    $categoryName,
                    $product->item_name,
                    $product->sub_details
                ),
                'unit'                  => $product->unit,
                'stock_level'           => $validated['quantity'],
                'min_stock_level'       => $product->min_stock_level,
                'price'                 => $validated['price']         ?? $product->price,
                'selling_price'         => $validated['selling_price'] ?? $product->selling_price,
                'supplier'              => $validated['supplier']      ?? $product->supplier,
                'expiration_date'       => $validated['expiration_date'] ?? null,
                'lot_number'            => $validated['lot_number']      ?? null,
                'batch_number'          => $validated['batch_number'],
                // Carry over the billing/consumption flags so the new batch is
                // treated exactly like the stock it replenishes.
                'is_billable'           => $product->is_billable,
                'is_consumable'         => $product->is_consumable,
                'deduct_on_finalize'    => $product->deduct_on_finalize,
                'status'                => 'In Stock',
            ]);

            InventoryTransaction::create([
                'inventory_id'     => $batch->id,
                'transaction_type' => 'Stock In',
                'quantity'         => $batch->stock_level,
                'previous_stock'   => 0,
                'new_stock'        => $batch->stock_level,
                'remarks'          => $validated['remarks'] ?? "Received batch {$batch->batch_number}",
                'created_by'       => auth()->id() ?? (Admin::first()->id ?? null),
            ]);

            return $batch;
        });

        $this->createInternalNotification(
            'StockAdjustment',
            'Stock Received',
            "Received {$batch->stock_level} units of '{$batch->item_name}' as batch {$batch->batch_number}.",
            ['inventory_id' => $batch->id]
        );

        event(new \App\Events\InventoryUpdated($batch));

        RefreshInventoryForecast::dispatch([$batch->id], 'manual');

        return response()->json($batch->load('inventoryCategory'), 201);
    }

    /**
     * List every batch sharing a product's code, oldest first — the exact order
     * InvoiceFinalizationService will consume them in.
     */
    public function batches(Inventory $inventory)
    {
        $query = Inventory::query();

        if (!empty($inventory->code)) {
            $query->where('code', $inventory->code);
        } else {
            $query->where('id', $inventory->id);
        }

        $batches = $query->orderBy('id', 'asc')->get();

        return response()->json([
            'code'        => $inventory->code,
            'total_stock' => $batches->sum('stock_level'),
            'batches'     => $batches,
        ]);
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

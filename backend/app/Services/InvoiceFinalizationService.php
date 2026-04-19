<?php

namespace App\Services;

use App\Jobs\RefreshInventoryForecast;
use App\Models\Invoice;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\InventoryUsageHistory;
use App\Models\Admin;
use App\Events\LowStockDetected;
use App\Traits\HasInternalNotifications;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Exception;

class InvoiceFinalizationService
{
    use HasInternalNotifications;
    /**
     * Finalize an invoice and deduct inventory stock.
     * 
     * @param Invoice $invoice
     * @return void
     * @throws Exception
     */
    public function finalizeInvoice(Invoice $invoice)
    {
        $affectedInventoryIds = [];

        DB::transaction(function () use ($invoice, &$affectedInventoryIds) {
            // Check if status is valid and stock not already deducted
            if ($invoice->stock_deducted) {
                return; // Already deducted
            }

            if ($invoice->status !== 'Finalized' && $invoice->status !== 'Paid' && $invoice->status !== 'Partially Paid') {
                return; // We only deduct when it reaches these states
            }

            $usageDate = now()->toDateString();

            // Loop through items
            foreach ($invoice->items as $item) {
                if ($item->inventory_id) {
                    $inventoryItem = Inventory::where('id', $item->inventory_id)->lockForUpdate()->first();

                    if (!$inventoryItem) {
                        throw new Exception("Inventory item not found for ID: {$item->inventory_id}");
                    }

                    // For inventory type items, we only deduct if the flag is set
                    if ($item->item_type === 'inventory' && !$inventoryItem->deduct_on_finalize) {
                        continue;
                    }

                    // If it's a service and we have logic for consumables, we'd check that here.
                    // For now, any item with an inventory_id attached is treated as needing deduction
                    // if it's explicitly billed as a product OR if it's a linked consumable.

                    // Mandatory Rule: Reject if stock is already zero or below
                    if ($inventoryItem->stock_level <= 0) {
                        throw new Exception("Cannot deduct '{$inventoryItem->item_name}'. Item is currently OUT OF STOCK.");
                    }

                    // Mandatory Rule: Reject if deduction causes negative stock
                    if ($inventoryItem->stock_level < $item->qty) {
                        throw new Exception("Insufficient stock for item '{$inventoryItem->item_name}'. Required: {$item->qty}, Available: {$inventoryItem->stock_level}. Transaction rejected to prevent negative stock.");
                    }

                    $oldStock = $inventoryItem->stock_level;
                    $inventoryItem->stock_level -= $item->qty;
                    $inventoryItem->save();

                    // Broadcast inventory update
                    event(new \App\Events\InventoryUpdated($inventoryItem));

                    // Log the transaction
                    InventoryTransaction::create([
                        'inventory_id' => $inventoryItem->id,
                        'transaction_type' => $item->item_type === 'service' ? 'Service Consumable' : 'Retail Sale',
                        'quantity' => -$item->qty,
                        'previous_stock' => $oldStock,
                        'new_stock' => $inventoryItem->stock_level,
                        'remarks' => "Deducted from Invoice #{$invoice->invoice_number} (" . ucfirst($item->item_type) . " item)",
                        'created_by' => auth()->id() ?? (Admin::first()->id ?? null)
                    ]);

                    // Record clean sale-based usage history (skip if already inserted for this invoice item)
                    InventoryUsageHistory::firstOrCreate(
                        ['invoice_item_id' => $item->id],
                        [
                            'inventory_id' => $inventoryItem->id,
                            'invoice_id'   => $invoice->id,
                            'quantity_used' => $item->qty,
                            'usage_date'   => $usageDate,
                            'source_type'  => $item->item_type === 'service' ? 'service_consumable' : 'retail_sale',
                            'unit_price'   => $item->unit_price ?? $inventoryItem->selling_price,
                        ]
                    );

                    $affectedInventoryIds[] = $inventoryItem->id;

                    // Internal admin notification for stock deduction
                    $this->createInternalNotification(
                        'StockAdjustment',
                        'Inventory Subtracted',
                        "{$item->qty} units of '{$inventoryItem->item_name}' were deducted due to Invoice #{$invoice->invoice_number}.",
                        ['inventory_id' => $inventoryItem->id, 'invoice_id' => $invoice->id]
                    );

                    // Trigger low stock event if necessary
                    if ($inventoryItem->stock_level <= $inventoryItem->min_stock_level) {
                        event(new LowStockDetected($inventoryItem));
                    }
                }
            }

            $invoice->stock_deducted = true;
            $invoice->save();

            // Clear Service Forecast Cache to reflect new live transaction
            Cache::forget('service_forecast_v7');

            // Internal admin notification for invoice finalization
            $this->createInternalNotification(
                'InvoiceFinalized',
                'Invoice Finalized',
                "Invoice #{$invoice->invoice_number} for {$invoice->pet->name} has been finalized. Total: ₱" . number_format($invoice->total, 2),
                ['invoice_id' => $invoice->id]
            );
        });

        // Collect IDs to refresh even if already deducted, ensuring re-saves can trigger a forecast update.
        $affectedInventoryIds = array_unique(array_merge(
            $affectedInventoryIds,
            $invoice->items->pluck('inventory_id')->filter()->toArray()
        ));

        if (!empty($affectedInventoryIds)) {
            try {
                RefreshInventoryForecast::dispatch($affectedInventoryIds, 'invoice_finalization');
                \Illuminate\Support\Facades\Log::info(
                    '[QUEUE DISPATCHED] AI Inventory Forecast Refresh queued on "default" queue.',
                    ['invoice_number' => $invoice->invoice_number, 'inventory_count' => count($affectedInventoryIds)]
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error(
                    '[QUEUE DISPATCH FAILED] AI Forecast could not be queued.',
                    ['invoice_number' => $invoice->invoice_number, 'error' => $e->getMessage()]
                );
            }
        }
    }
}

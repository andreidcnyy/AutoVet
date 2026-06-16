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
                    $originalItem = Inventory::where('id', $item->inventory_id)->lockForUpdate()->first();

                    if (!$originalItem) {
                        throw new Exception("Inventory item not found for ID: {$item->inventory_id}");
                    }

                    // For inventory type items, we only deduct if the flag is set
                    if ($item->item_type === 'inventory' && !$originalItem->deduct_on_finalize) {
                        continue;
                    }

                    // FIFO Logic: Find all batches with the same item code
                    // If no code, we fall back to just the original item
                    $itemCode = $originalItem->code;
                    $batches = [];
                    
                    if ($itemCode) {
                        $batches = Inventory::where('code', $itemCode)
                            ->where('stock_level', '>', 0)
                            ->orderBy('id', 'asc') // FIFO by ID
                            ->lockForUpdate()
                            ->get();
                    }

                    // If for some reason we found no batches with stock (even the original one)
                    // we still want to proceed with shortage handling logic using the original item's info
                    if (empty($batches) || $batches->count() === 0) {
                        $batches = collect([$originalItem]);
                    }

                    // Check total available across all batches
                    $totalAvailable = $batches->sum('stock_level');
                    $qtyToDeduct = $item->qty;

                    // Stock shortage handling depends on item type.
                    if ($totalAvailable < $qtyToDeduct) {
                        if ($item->item_type === 'service') {
                            \Illuminate\Support\Facades\Log::warning(
                                "[INVOICE-SERVICE-CONSUMABLE-SHORTAGE] Skipping deduction for invoice #{$invoice->invoice_number}",
                                [
                                    'inventory_id' => $originalItem->id,
                                    'item_name'    => $originalItem->item_name,
                                    'required'     => $qtyToDeduct,
                                    'available'    => $totalAvailable,
                                ]
                            );

                            $this->createInternalNotification(
                                'StockShortage',
                                'Service Consumable Shortage',
                                "Invoice #{$invoice->invoice_number} finalized but service consumable '{$originalItem->item_name}' could not be deducted (required {$qtyToDeduct}, available {$totalAvailable}). Reorder needed.",
                                ['inventory_id' => $originalItem->id, 'invoice_id' => $invoice->id]
                            );

                            if ($totalAvailable <= $originalItem->min_stock_level) {
                                event(new LowStockDetected($originalItem));
                            }

                            continue;
                        }

                        if ($totalAvailable <= 0) {
                            throw new Exception("Cannot bill retail item '{$originalItem->item_name}'. Item is currently OUT OF STOCK.");
                        }

                        throw new Exception("Insufficient stock for retail item '{$originalItem->item_name}'. Required: {$qtyToDeduct}, Available: {$totalAvailable}. Remove or restock before finalizing.");
                    }

                    // Perform FIFO Deduction
                    foreach ($batches as $batchItem) {
                        if ($qtyToDeduct <= 0) break;

                        $deductFromThisBatch = min($batchItem->stock_level, $qtyToDeduct);
                        if ($deductFromThisBatch <= 0) continue;

                        $oldStock = $batchItem->stock_level;
                        $batchItem->stock_level -= $deductFromThisBatch;
                        $batchItem->save();
                        
                        $qtyToDeduct -= $deductFromThisBatch;

                        // Broadcast inventory update
                        event(new \App\Events\InventoryUpdated($batchItem));

                        // Log the transaction
                        InventoryTransaction::create([
                            'inventory_id' => $batchItem->id,
                            'transaction_type' => $item->item_type === 'service' ? 'Service Consumable' : 'Retail Sale',
                            'quantity' => -$deductFromThisBatch,
                            'previous_stock' => $oldStock,
                            'new_stock' => $batchItem->stock_level,
                            'remarks' => "Deducted (FIFO) from Invoice #{$invoice->invoice_number} (" . ucfirst($item->item_type) . " item)",
                            'created_by' => auth()->id() ?? (Admin::first()->id ?? null)
                        ]);

                        // Record clean sale-based usage history
                        InventoryUsageHistory::create([
                            'invoice_item_id' => $item->id,
                            'inventory_id' => $batchItem->id,
                            'invoice_id'   => $invoice->id,
                            'quantity_used' => $deductFromThisBatch,
                            'usage_date'   => $usageDate,
                            'source_type'  => $item->item_type === 'service' ? 'service_consumable' : 'retail_sale',
                            'unit_price'   => $item->unit_price ?? $batchItem->selling_price,
                        ]);

                        $affectedInventoryIds[] = $batchItem->id;

                        // Internal admin notification for stock deduction
                        $this->createInternalNotification(
                            'StockAdjustment',
                            'Inventory Subtracted',
                            "{$deductFromThisBatch} units of '{$batchItem->item_name}' (Batch: {$batchItem->batch_number}) were deducted due to Invoice #{$invoice->invoice_number}.",
                            ['inventory_id' => $batchItem->id, 'invoice_id' => $invoice->id]
                        );

                        // Trigger low stock event if necessary
                        if ($batchItem->stock_level <= $batchItem->min_stock_level) {
                            event(new LowStockDetected($batchItem));
                        }
                    }
                }
            }

            $invoice->stock_deducted = true;
            $invoice->save();


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

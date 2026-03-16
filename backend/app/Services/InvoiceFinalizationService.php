<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Inventory;
use App\Events\LowStockDetected;
use Illuminate\Support\Facades\DB;
use Exception;

class InvoiceFinalizationService
{
    /**
     * Finalize an invoice and deduct inventory stock.
     * 
     * @param Invoice $invoice
     * @return void
     * @throws Exception
     */
    public function finalizeInvoice(Invoice $invoice)
    {
        DB::transaction(function () use ($invoice) {
            // Check if status is valid and stock not already deducted
            if ($invoice->stock_deducted) {
                return; // Already deducted
            }
            
            if ($invoice->status !== 'Finalized' && $invoice->status !== 'Paid' && $invoice->status !== 'Partially Paid') {
                return; // We only deduct when it reaches these states
            }

            // Loop through items
            foreach ($invoice->items as $item) {
                if ($item->inventory_id) {
                    $inventoryItem = Inventory::where('id', $item->inventory_id)->lockForUpdate()->first();

                    if (!$inventoryItem) {
                        throw new Exception("Inventory item not found for ID: {$item->inventory_id}");
                    }

                    if ($inventoryItem->stock_level < $item->qty) {
                        throw new Exception("Insufficient stock for item: {$inventoryItem->item_name}. Needed: {$item->qty}, Available: {$inventoryItem->stock_level}");
                    }

                    // Deduct stock
                    $inventoryItem->stock_level -= $item->qty;
                    $inventoryItem->save();

                    // Trigger low stock event if necessary
                    if ($inventoryItem->stock_level <= $inventoryItem->min_stock_level) {
                        event(new LowStockDetected($inventoryItem));
                    }
                }
            }
            
            $invoice->stock_deducted = true;
            $invoice->save();
        });
    }
}

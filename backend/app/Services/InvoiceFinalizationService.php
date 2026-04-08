<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
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

                    // For inventory type items, we only deduct if the flag is set
                    if ($item->item_type === 'inventory' && !$inventoryItem->deduct_on_finalize) {
                        continue;
                    }

                    // If it's a service and we have logic for consumables, we'd check that here.
                    // For now, any item with an inventory_id attached is treated as needing deduction 
                    // if it's explicitly billed as a product OR if it's a linked consumable.

                    if ($inventoryItem->stock_level < $item->qty) {
                        throw new Exception("Insufficient stock for item '{$inventoryItem->item_name}'. Required: {$item->qty}, Available: {$inventoryItem->stock_level}");
                    }

                    $oldStock = $inventoryItem->stock_level;
                    $inventoryItem->stock_level -= $item->qty;
                    $inventoryItem->save();

                    // Log the transaction
                    InventoryTransaction::create([
                        'inventory_id' => $inventoryItem->id,
                        'transaction_type' => $item->item_type === 'service' ? 'Service Consumable' : 'Retail Sale',
                        'quantity' => -$item->qty,
                        'previous_stock' => $oldStock,
                        'new_stock' => $inventoryItem->stock_level,
                        'remarks' => "Deducted from Invoice #{$invoice->invoice_number} (" . ucfirst($item->item_type) . " item)",
                        'created_by' => auth()->id() ?? (\App\Models\User::first()->id ?? null)
                    ]);

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

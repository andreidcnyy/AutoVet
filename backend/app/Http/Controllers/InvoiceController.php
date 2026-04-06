<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Services\InvoiceFinalizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceController extends Controller
{
    protected $pricingService;
    protected $finalizationService;

    public function __construct(
        \App\Services\PricingService $pricingService,
        \App\Services\InvoiceFinalizationService $finalizationService
    ) {
        $this->pricingService = $pricingService;
        $this->finalizationService = $finalizationService;
    }

    /**
     * Display a listing of invoices.
     */
    public function index()
    {
        $invoices = Invoice::with('pet', 'items')->orderBy('created_at', 'desc')->get();
        return response()->json($invoices);
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'pet_id' => 'required|exists:pets,id',
            'appointment_id' => 'required|exists:appointments,id',
            'status' => 'required|in:Draft,Finalized,Paid,Partially Paid,Cancelled',
            'subtotal' => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'tax_rate' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'amount_paid' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string',
            'notes_to_client' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_type' => 'required|in:service,inventory',
            'items.*.name' => 'required|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.inventory_id' => 'nullable|exists:inventories,id',
        ]);

        if ($validated['discount_value'] > $validated['subtotal'] && $validated['discount_type'] === 'fixed') {
             throw ValidationException::withMessages(['discount_value' => 'Discount cannot exceed subtotal.']);
        }
        
        if ($validated['status'] === 'Finalized' && $validated['subtotal'] <= 0) {
            throw ValidationException::withMessages(['subtotal' => 'Cannot finalize an invoice with 0 subtotal.']);
        }

        DB::beginTransaction();

        try {
            $monthYear = now()->format('Y-m');
            $latestInvoice = Invoice::where('invoice_number', 'like', "VB-{$monthYear}-%")->latest('id')->first();
            $nextNumber = $latestInvoice ? intval(substr($latestInvoice->invoice_number, -4)) + 1 : 1;
            $invoiceNumber = "VB-{$monthYear}-" . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

            $pet = \App\Models\Pet::findOrFail($validated['pet_id']);
            $calculatedSubtotal = 0;
            $itemsToCreate = [];

            foreach ($validated['items'] as $itemData) {
                if ($itemData['item_type'] === 'service') {
                    $service = \App\Models\Service::find($itemData['service_id']);
                    if ($service && $service->pricing_mode !== 'manual') {
                        $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet);
                    }
                } else if ($itemData['item_type'] === 'inventory') {
                    $inventory = \App\Models\Inventory::find($itemData['inventory_id']);
                    if ($inventory) {
                        // Use selling price as source of truth
                        $itemData['unit_price'] = (float) $inventory->selling_price;
                    }
                }

                $itemAmount = $itemData['unit_price'] * $itemData['qty'];
                $calculatedSubtotal += $itemAmount;
                $itemsToCreate[] = array_merge($itemData, ['amount' => $itemAmount]);
            }

            // Recalculate total based on backend rules
            $discount = ($validated['discount_type'] === 'percentage') 
                ? $calculatedSubtotal * ($validated['discount_value'] / 100) 
                : $validated['discount_value'];
            
            $taxable = $calculatedSubtotal - $discount;
            // Enforce fixed 12% VAT
            $validated['tax_rate'] = 12.00;
            $tax = $taxable * 0.12; 
            $calculatedTotal = $taxable + $tax;

            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'pet_id' => $validated['pet_id'],
                'appointment_id' => $validated['appointment_id'],
                'status' => $validated['status'],
                'subtotal' => $calculatedSubtotal,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $calculatedTotal,
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            foreach ($itemsToCreate as $item) {
                $invoice->items()->create($item);
            }

            $invoice->load('items');
            $this->finalizationService->finalizeInvoice($invoice);

            DB::commit();
            return response()->json($invoice->load('pet', 'items'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create invoice.', 'errors' => [$e->getMessage()]], 500);
        }
    }

    /**
     * Display the specified invoice.
     */
    public function show(Invoice $invoice)
    {
        return response()->json($invoice->load('pet', 'items'));
    }

    /**
     * Update the specified invoice in storage.
     */
    public function update(Request $request, Invoice $invoice)
    {
        if (in_array($invoice->status, ['Paid', 'Cancelled'])) {
             return response()->json(['message' => 'Cannot modify a Paid or Cancelled invoice.'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:Draft,Finalized,Paid,Partially Paid,Cancelled',
            'subtotal' => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'tax_rate' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'amount_paid' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string',
            'notes_to_client' => 'nullable|string',
            'items' => 'sometimes|array',
            'items.*.id' => 'nullable|exists:invoice_items,id',
            'items.*.item_type' => 'required_with:items|in:service,inventory',
            'items.*.name' => 'required_with:items|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.amount' => 'required_with:items|numeric|min:0',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.inventory_id' => 'nullable|exists:inventories,id',
        ]);

        if ($invoice->status === 'Finalized' && in_array($validated['status'], ['Draft', 'Finalized'])) {
             // If already finalized, only allow payment updates
             $invoice->update([
                 'amount_paid' => $validated['amount_paid'],
                 'payment_method' => $validated['payment_method'] ?? $invoice->payment_method,
                 'status' => $validated['status']
             ]);
             return response()->json($invoice->load('pet', 'items'));
        }

        DB::beginTransaction();

        try {
            $pet = $invoice->pet;
            $calculatedSubtotal = 0;
            $itemsToUpdate = [];

            if (isset($validated['items'])) {
                foreach ($validated['items'] as $itemData) {
                    if ($itemData['item_type'] === 'service') {
                        $service = \App\Models\Service::find($itemData['service_id']);
                        if ($service && $service->pricing_mode !== 'manual') {
                            $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet);
                        }
                    } else if ($itemData['item_type'] === 'inventory') {
                        $inventory = \App\Models\Inventory::find($itemData['inventory_id']);
                        if ($inventory) {
                            $itemData['unit_price'] = (float) $inventory->selling_price;
                        }
                    }

                    $itemAmount = $itemData['unit_price'] * $itemData['qty'];
                    $calculatedSubtotal += $itemAmount;
                    $itemsToUpdate[] = array_merge($itemData, ['amount' => $itemAmount]);
                }
            } else {
                $calculatedSubtotal = $invoice->subtotal;
            }

            // Recalculate total based on backend rules
            $discount = ($validated['discount_type'] === 'percentage') 
                ? $calculatedSubtotal * ($validated['discount_value'] / 100) 
                : $validated['discount_value'];
            
            $taxable = $calculatedSubtotal - $discount;
            // Enforce fixed 12% VAT
            $validated['tax_rate'] = 12.00;
            $tax = $taxable * 0.12; 
            $calculatedTotal = $taxable + $tax;

            // Determine status logic based on amount paid vs total
            $status = $validated['status'];
            if ($status === 'Finalized' && $validated['amount_paid'] > 0) {
                if ($validated['amount_paid'] >= $calculatedTotal) {
                    $status = 'Paid';
                } else {
                    $status = 'Partially Paid';
                }
            }

            $invoice->update([
                'status' => $status,
                'subtotal' => $calculatedSubtotal,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $calculatedTotal,
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            if (isset($validated['items'])) {
                // Delete items not in the updated list
                $itemIds = collect($itemsToUpdate)->pluck('id')->filter()->toArray();
                $invoice->items()->whereNotIn('id', $itemIds)->delete();

                foreach ($itemsToUpdate as $itemData) {
                    if (isset($itemData['id'])) {
                        $invoice->items()->where('id', $itemData['id'])->update($itemData);
                    } else {
                        $invoice->items()->create($itemData);
                    }
                }
            }

            $invoice->load('items');
            $this->finalizationService->finalizeInvoice($invoice);

            DB::commit();
            return response()->json($invoice->load('pet', 'items'));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update invoice.', 'errors' => [$e->getMessage()]], 500);
        }
    }

    /**
     * Remove the specified invoice.
     */
    public function destroy(Invoice $invoice)
    {
        return response()->json(['message' => 'Transactions cannot be deleted as per system policy.'], 403);
    }
}

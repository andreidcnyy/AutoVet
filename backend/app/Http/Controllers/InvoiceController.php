<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Services\InvoiceFinalizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Traits\IdentifiesPortalOwner;

class InvoiceController extends Controller
{
    use IdentifiesPortalOwner;

    protected $pricingService;
    protected $finalizationService;
    protected $clientNotificationService;

    public function __construct(
        \App\Services\PricingService $pricingService,
        \App\Services\InvoiceFinalizationService $finalizationService,
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->pricingService = $pricingService;
        $this->finalizationService = $finalizationService;
        $this->clientNotificationService = $clientNotificationService;
        $this->authorizeResource(Invoice::class, 'invoice');
    }

    /**
     * Display a listing of invoices.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Invoice::with(['pet.species', 'pet.breed', 'pet.owner', 'items']);

        if ($ownerId = $this->getPortalOwnerId()) {
            $query->whereHas('pet', function ($q) use ($ownerId) {
                $q->where('owner_id', $ownerId);
            });
        }

        if ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('pet', function ($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%")
                        ->orWhereHas('owner', function ($oq) use ($search) {
                            $oq->where('name', 'like', "%{$search}%");
                        });
                  });
            });
        }

        $query->orderBy('created_at', 'desc');

        if ($request->has('per_page')) {
            return response()->json($query->paginate($request->per_page));
        }

        return response()->json($query->get());
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request)
    {
        $this->authorize('create', Invoice::class);

        $validated = $request->validate([
            'pet_id' => 'required|exists:pets,id',
            'appointment_id' => 'required|exists:appointments,id',
            'pet_weight' => 'nullable|numeric|min:0.01',
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
            
            // Update pet weight if provided
            if (isset($validated['pet_weight'])) {
                $pet->update(['weight' => $validated['pet_weight']]);
            }

            $calculatedSubtotal = 0;
            $itemsToCreate = [];

            foreach ($validated['items'] as $itemData) {
                if ($itemData['item_type'] === 'service') {
                    $service = \App\Models\Service::find($itemData['service_id']);
                    if ($service && $service->pricing_mode !== 'manual') {
                        try {
                            $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet, 1, null, $validated['pet_weight'] ?? null);
                        } catch (\Exception $e) {
                             throw ValidationException::withMessages(['items' => $e->getMessage()]);
                        }
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
                $itemsToCreate[] = array_merge($itemData, ['amount' => $itemAmount, 'is_hidden' => false]);

                // Auto-add consumables
                if ($itemData['item_type'] === 'service' && $service) {
                    $service->load('consumables');
                    foreach ($service->consumables as $consumable) {
                        $itemsToCreate[] = [
                            'item_type' => 'inventory',
                            'inventory_id' => $consumable->inventory_id,
                            'name' => $consumable->inventory->item_name ?? "Consumable",
                            'qty' => $consumable->quantity * $itemData['qty'],
                            'unit_price' => 0,
                            'amount' => 0,
                            'is_hidden' => true,
                            'notes' => "Linked consumable for {$service->name}"
                        ];
                    }
                }
            }

            // Determine status logic based on backend rules
            $discount = ($validated['discount_type'] === 'percentage') 
                ? $calculatedSubtotal * ($validated['discount_value'] / 100) 
                : $validated['discount_value'];
            
            $taxable = $calculatedSubtotal - $discount;
            // Enforce fixed 12% VAT
            $validated['tax_rate'] = 12.00;
            $tax = round($taxable * 0.12, 2); 
            $calculatedTotal = round($taxable + $tax, 2);

            // Refined status logic: If finalized but fully paid, mark as Paid (Receipt mode)
            $finalStatus = $validated['status'];
            if ($finalStatus === 'Finalized' && $validated['amount_paid'] >= $calculatedTotal) {
                $finalStatus = 'Paid';
            } else if ($finalStatus === 'Finalized' && $validated['amount_paid'] > 0) {
                $finalStatus = 'Partially Paid';
            }

            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'pet_id' => $validated['pet_id'],
                'appointment_id' => $validated['appointment_id'],
                'status' => $finalStatus,
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

            if (in_array($invoice->status, ['Finalized', 'Paid'])) {
                try {
                    $owner = $invoice->pet->owner;
                    if ($owner) {
                        $this->clientNotificationService->sendInvoiceEmail($owner, $invoice);
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to send automated invoice notification: " . $e->getMessage());
                }
            }

            DB::commit();
            return response()->json($invoice->load('pet', 'items'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Illuminate\Support\Facades\Log::error("Invoice creation failed: " . $e->getMessage(), [
                'stack' => $e->getTraceAsString(),
                'payload' => $request->all()
            ]);
            return response()->json([
                'message' => 'Failed to create invoice.', 
                'error' => $e->getMessage()
            ], 500);
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
            'pet_weight' => 'nullable|numeric|min:0.01',
            'appointment_id' => 'nullable|exists:appointments,id',
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
                 'appointment_id' => $validated['appointment_id'] ?? $invoice->appointment_id,
                 'status' => $validated['status']
             ]);
             return response()->json($invoice->load('pet', 'items'));
        }

        DB::beginTransaction();

        try {
            $pet = $invoice->pet;
            $calculatedSubtotal = 0;
            $itemsToUpdate = [];

            if (isset($validated['pet_weight'])) {
                $pet->update(['weight' => $validated['pet_weight']]);
            }

            if (isset($validated['items'])) {
                // Delete existing hidden items first to re-add them based on updated services
                $invoice->items()->where('is_hidden', true)->delete();

                foreach ($validated['items'] as $itemData) {
                    if ($itemData['item_type'] === 'service') {
                        $service = \App\Models\Service::find($itemData['service_id']);
                        if ($service && $service->pricing_mode !== 'manual') {
                            try {
                                $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet, 1, null, $validated['pet_weight'] ?? null);
                            } catch (\Exception $e) {
                                 throw ValidationException::withMessages(['items' => $e->getMessage()]);
                            }
                        }
                    } else if ($itemData['item_type'] === 'inventory') {
                        $inventory = \App\Models\Inventory::find($itemData['inventory_id']);
                        if ($inventory) {
                            $itemData['unit_price'] = (float) $inventory->selling_price;
                        }
                    }

                    $itemAmount = $itemData['unit_price'] * $itemData['qty'];
                    $calculatedSubtotal += $itemAmount;
                    $itemsToUpdate[] = array_merge($itemData, ['amount' => $itemAmount, 'is_hidden' => false]);

                    // Auto-add consumables
                    if ($itemData['item_type'] === 'service' && $service) {
                        $service->load('consumables');
                        foreach ($service->consumables as $consumable) {
                            $itemsToUpdate[] = [
                                'item_type' => 'inventory',
                                'inventory_id' => $consumable->inventory_id,
                                'name' => $consumable->inventory->item_name ?? "Consumable",
                                'qty' => $consumable->quantity * $itemData['qty'],
                                'unit_price' => 0,
                                'amount' => 0,
                                'is_hidden' => true,
                                'notes' => "Linked consumable for {$service->name}"
                            ];
                        }
                    }
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
                'appointment_id' => $validated['appointment_id'] ?? $invoice->appointment_id,
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

            if ($invoice->wasChanged('status') && $invoice->status === 'Finalized') {
                try {
                    $owner = $invoice->pet->owner;
                    if ($owner) {
                        $this->clientNotificationService->sendInvoiceEmail($owner, $invoice);
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to send automated invoice notification: " . $e->getMessage());
                }
            }

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

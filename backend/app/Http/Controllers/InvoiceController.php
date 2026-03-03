<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceController extends Controller
{
    /**
     * Display a listing of invoices.
     */
    public function index()
    {
        return Invoice::with('patient', 'items')->orderBy('created_at', 'desc')->get();
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'patient_id' => 'required|exists:patients,id',
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
            'items.*.name' => 'required|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.amount' => 'required|numeric|min:0',
        ]);

        if ($validated['discount_value'] > clone $validated['subtotal'] && $validated['discount_type'] === 'fixed') {
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

            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'patient_id' => $validated['patient_id'],
                'status' => $validated['status'],
                'subtotal' => $validated['subtotal'],
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $validated['total'],
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            foreach ($validated['items'] as $item) {
                $invoice->items()->create($item);
            }

            DB::commit();
            return response()->json($invoice->load('patient', 'items'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to create invoice.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified invoice.
     */
    public function show(Invoice $invoice)
    {
        return $invoice->load('patient', 'items');
    }

    /**
     * Update the specified invoice in storage.
     */
    public function update(Request $request, Invoice $invoice)
    {
        if (in_array($invoice->status, ['Paid', 'Cancelled'])) {
             return response()->json(['error' => 'Cannot modify a Paid or Cancelled invoice.'], 403);
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
            'items.*.name' => 'required_with:items|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.amount' => 'required_with:items|numeric|min:0',
        ]);

        if ($invoice->status === 'Finalized' && in_array($validated['status'], ['Draft', 'Finalized'])) {
             // If already finalized, only allow payment updates (which changes status to Paid/Partially Paid)
             $invoice->update([
                 'amount_paid' => $validated['amount_paid'],
                 'payment_method' => $validated['payment_method'] ?? $invoice->payment_method,
                 'status' => $validated['status']
             ]);
             return response()->json($invoice->load('patient', 'items'));
        }

        DB::beginTransaction();

        try {
            $invoice->update([
                'status' => $validated['status'],
                'subtotal' => $validated['subtotal'],
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $validated['total'],
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            if (isset($validated['items'])) {
                // Delete items not in the updated list
                $itemIds = collect($validated['items'])->pluck('id')->filter()->toArray();
                $invoice->items()->whereNotIn('id', $itemIds)->delete();

                foreach ($validated['items'] as $itemData) {
                    if (isset($itemData['id'])) {
                        $invoice->items()->where('id', $itemData['id'])->update($itemData);
                    } else {
                        $invoice->items()->create($itemData);
                    }
                }
            }

            DB::commit();
            return response()->json($invoice->load('patient', 'items'));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to update invoice.', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified invoice.
     */
    public function destroy(Invoice $invoice)
    {
        if (!in_array($invoice->status, ['Draft', 'Cancelled'])) {
            return response()->json(['error' => 'Only Draft or Cancelled invoices can be deleted.'], 403);
        }
        
        $invoice->delete();
        return response()->json(null, 204);
    }
}

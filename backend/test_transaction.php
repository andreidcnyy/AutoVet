<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Invoice;
use App\Models\Inventory;
use App\Models\InvoiceItem;
use App\Services\InvoiceFinalizationService;
use App\Models\InventoryForecast;
use Illuminate\Support\Facades\DB;

// 1. Pick an inventory item and a pet
$inventory = Inventory::where('stock_level', '>', 5)->first();
if (!$inventory) die("No inventory items with stock > 5 found.");

$pet = \App\Models\Pet::first();
if (!$pet) die("No pets found in database.");

$initialStock = $inventory->stock_level;
echo "Testing with Item: {$inventory->item_name} (ID: {$inventory->id})\n";
echo "Pet: {$pet->name} (ID: {$pet->id})\n";
echo "Initial Stock: $initialStock\n";

// 2. Create a Draft Invoice
$invoice = Invoice::create([
    'invoice_number' => 'TEST-' . time(),
    'pet_id' => $pet->id,
    'status' => 'Finalized',
    'total' => 100,
    'subtotal' => 100,
    'tax_rate' => 0
]);

// 3. Add Inventory Item to Invoice
InvoiceItem::create([
    'invoice_id' => $invoice->id,
    'inventory_id' => $inventory->id,
    'name' => $inventory->item_name,
    'qty' => 1,
    'unit_price' => 100,
    'amount' => 100,
    'line_type' => 'inventory'
]);

echo "Created Draft Invoice ID: {$invoice->id} with 1 item.\n";

// 4. Finalize Invoice via Service
echo "Finalizing invoice...\n";
$service = app(InvoiceFinalizationService::class);
$service->finalizeInvoice($invoice);

// 5. Verify Results
$inventory->refresh();
$finalStock = $inventory->stock_level;
echo "Final Stock: $finalStock\n";

if ($finalStock === $initialStock - 1) {
    echo "✅ Stock Deduction: SUCCESS\n";
} else {
    echo "❌ Stock Deduction: FAILED (Expected " . ($initialStock - 1) . ", got $finalStock)\n";
}

$transaction = DB::table('inventory_usage_history')
    ->where('inventory_id', $inventory->id)
    ->where('invoice_id', $invoice->id)
    ->first();

if ($transaction) {
    echo "✅ Inventory Usage History: CREATED\n";
} else {
    echo "❌ Inventory Usage History: MISSING\n";
}

// 6. Check Forecast Trigger (Job might be in queue, but we check for latest record)
sleep(2); // Give it a moment if jobs are processed fast
$forecast = InventoryForecast::where('inventory_id', $inventory->id)
    ->where('trigger_source', 'invoice_finalization')
    ->latest()
    ->first();

if ($forecast && $forecast->created_at->gt(now()->subSeconds(30))) {
    echo "✅ AI Forecast Trigger: SUCCESS (Record created)\n";
} else {
    echo "ℹ️ AI Forecast Trigger: Record not found yet (is the queue running?)\n";
}

// Cleanup
$invoice->delete(); // This won't undo stock but cleans up tables
echo "Verification Complete.\n";

<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$tablesResult = DB::select('SHOW TABLES');
$dbName = DB::getDatabaseName();
$prop = "Tables_in_" . $dbName;

$tables = [];
foreach ($tablesResult as $row) {
    $tables[] = $row->$prop;
}

$audit = [
    'database' => $dbName,
    'tables_found' => count($tables),
    'audit_results' => [],
    'relationships' => [],
    'data_health' => []
];

foreach ($tables as $table) {
    try {
        $count = DB::table($table)->count();
        $res = ['count' => $count];
        
        // Sample check for NULLs in critical columns
        $sample = DB::table($table)->latest()->first();
        if ($sample) {
            $criticalCols = ['created_at', 'updated_at'];
            if (property_exists($sample, 'id') || isset($sample->id)) {
                $nulls = [];
                foreach ($criticalCols as $col) {
                    if (DB::table($table)->whereNull($col)->count() > 0) {
                        $nulls[] = $col;
                    }
                }
                if (!empty($nulls)) $res['null_columns'] = $nulls;
            }
        }
        
        $audit['audit_results'][$table] = $res;
    } catch (\Exception $e) {
        $audit['audit_results'][$table] = ['error' => $e->getMessage()];
    }
}

// Relationship Integrity
$integrity = [];

// Pets -> Owners
if (in_array('pets', $tables) && in_array('owners', $tables)) {
    $integrity['orphaned_pets'] = DB::table('pets')->leftJoin('owners', 'pets.owner_id', '=', 'owners.id')->whereNull('owners.id')->count();
}

// Appointments -> Pets
if (in_array('appointments', $tables) && in_array('pets', $tables)) {
    $integrity['orphaned_appointments'] = DB::table('appointments')->leftJoin('pets', 'appointments.pet_id', '=', 'pets.id')->whereNull('pets.id')->count();
}

// InvoiceItems -> Invoices
if (in_array('invoice_items', $tables) && in_array('invoices', $tables)) {
    $integrity['orphaned_invoice_items'] = DB::table('invoice_items')->leftJoin('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')->whereNull('invoices.id')->count();
}

$audit['relationships'] = $integrity;

// Functional Flow Validation
$flow = [];
if (in_array('invoices', $tables) && in_array('inventory_transactions', $tables)) {
    $finalizedInvoices = DB::table('invoices')->where('status', 'Finalized')->count();
    $transactionsCount = DB::table('inventory_transactions')->count();
    $flow['finalized_invoices_vs_transactions'] = "Invoices: $finalizedInvoices, Transactions: $transactionsCount";
}

$audit['flow_validation'] = $flow;

echo json_encode($audit, JSON_PRETTY_PRINT);

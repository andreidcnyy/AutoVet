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
foreach ($tablesResult as $row) { $tables[] = $row->$prop; }

$report = [
    'timestamp' => date('Y-m-d H:i:s'),
    'tables' => [],
    'anomalies' => [],
    'integrity' => []
];

foreach ($tables as $table) {
    try {
        $count = DB::table($table)->count();
        $report['tables'][$table] = ['count' => $count];
        
        // Check for missing timestamps (often missed in seeders)
        $missingTimestamps = DB::table($table)->whereNull('created_at')->count();
        if ($missingTimestamps > 0) {
            $report['anomalies'][] = "Table [$table] has $missingTimestamps records with missing created_at.";
        }
    } catch (\Exception $e) {
        $report['tables'][$table] = ['error' => $e->getMessage()];
    }
}

// Check Inventory critical fields
if (in_array('inventories', $tables)) {
    $nullPrice = DB::table('inventories')->whereNull('selling_price')->orWhere('selling_price', 0)->count();
    if ($nullPrice > 0) $report['anomalies'][] = "Inventory contains $nullPrice items with missing or zero selling_price.";
    
    $nullCode = DB::table('inventories')->whereNull('code')->count();
    if ($nullCode > 0) $report['anomalies'][] = "Inventory contains $nullCode items without a code.";
}

// Check Invoice integrity
if (in_array('invoices', $tables) && in_array('invoice_items', $tables)) {
    $invoicesWithoutItems = DB::table('invoices')
        ->leftJoin('invoice_items', 'invoices.id', '=', 'invoice_items.invoice_id')
        ->whereNull('invoice_items.id')
        ->count();
    if ($invoicesWithoutItems > 0) $report['anomalies'][] = "$invoicesWithoutItems invoices have no line items.";
    
    $pendingInvoices = DB::table('invoices')->where('status', 'Pending')->count();
    $draftInvoices = DB::table('invoices')->where('status', 'Draft')->count();
    $finalizedInvoices = DB::table('invoices')->where('status', 'Finalized')->count();
    $report['metrics']['invoices'] = [
        'draft' => $draftInvoices,
        'pending' => $pendingInvoices,
        'finalized' => $finalizedInvoices
    ];
}

// User role distribution
if (in_array('admins', $tables)) {
    $roles = DB::table('admins')->select('role', DB::raw('count(*) as count'))->groupBy('role')->get();
    $report['metrics']['admin_roles'] = $roles;
}

echo json_encode($report, JSON_PRETTY_PRINT);

<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use Illuminate\Http\Request;

$dashboard = app(DashboardController::class);
$inventory = app(InventoryController::class);

$report = [
    'dashboard_stats' => $dashboard->getStats()->original,
    'inventory_summary' => [],
];

// Verify inventory items and categories
$invItems = \App\Models\Inventory::with('inventoryCategory')->limit(5)->get();
foreach ($invItems as $item) {
    $report['inventory_summary'][] = [
        'name' => $item->item_name,
        'category' => $item->inventoryCategory->name ?? 'None',
        'stock' => $item->stock_level
    ];
}

echo json_encode($report, JSON_PRETTY_PRINT);

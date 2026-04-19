<?php
require __DIR__ . '/backend/vendor/autoload.php';
$app = require_once __DIR__ . '/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

use App\Models\Inventory;
use App\Models\InventoryForecast;

$inv = Inventory::where('code', 'INV-001')->first();
if ($inv) {
    echo "Item: " . $inv->item_name . "\n";
    echo "Stock: " . $inv->stock_level . "\n";
    echo "Min Stock: " . $inv->min_stock_level . "\n";
    
    $f = InventoryForecast::where('inventory_id', $inv->id)->orderBy('generated_at', 'desc')->first();
    if ($f) {
        echo "Avg Daily Consumption: " . $f->average_daily_consumption . "\n";
        echo "Predicted Monthly Sales: " . $f->predicted_monthly_sales . "\n";
        echo "Days Until Stockout: " . $f->days_until_stockout . "\n";
        echo "Predicted Stockout Date: " . $f->predicted_stockout_date . "\n";
        echo "Generated At: " . $f->generated_at . "\n";
    } else {
        echo "No forecast found.\n";
    }
} else {
    echo "Inventory item not found.\n";
}

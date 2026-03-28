<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\Owner;
use App\Models\Pet;
use App\Models\Appointment;
use Illuminate\Support\Facades\DB;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- DATA DIAGNOSTIC ---\n";
echo "Owner count: " . Owner::count() . "\n";
echo "Pet count: " . Pet::count() . "\n";
echo "Appointment count: " . Appointment::count() . "\n";
echo "Owner count (including soft deleted): " . Owner::withTrashed()->count() . "\n";

echo "Inventory Category count: " . DB::table('mdm_inventory_categories')->count() . "\n";
echo "Service Category count: " . DB::table('mdm_service_categories')->count() . "\n";
echo "Pet Size Category count: " . DB::table('pet_size_categories')->count() . "\n";
echo "Weight Range count: " . DB::table('weight_ranges')->count() . "\n";
echo "Unit count: " . DB::table('units_of_measure')->count() . "\n";

try {
    $dbName = DB::connection()->getDatabaseName();
    echo "Current Database: " . $dbName . "\n";
    
    $tables = DB::select('SHOW TABLES');
    echo "Tables in database:\n";
    foreach ($tables as $table) {
        $array = (array)$table;
        echo "- " . reset($array) . "\n";
    }
} catch (\Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}

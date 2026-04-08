<?php
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "Table: appointments\n";
try {
    $columns = DB::select('DESCRIBE appointments');
    foreach ($columns as $column) {
        echo sprintf("- %s (%s) %s %s\n", $column->Field, $column->Type, $column->Null, $column->Key);
    }
} catch (\Exception $e) {
    echo "Error describing: " . $e->getMessage() . "\n";
}

echo "\nForeign Keys:\n";
try {
    $fks = DB::select("SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
                       FROM information_schema.KEY_COLUMN_USAGE 
                       WHERE TABLE_NAME = 'appointments' AND TABLE_SCHEMA = 'autovet' AND REFERENCED_TABLE_NAME IS NOT NULL");
    foreach ($fks as $fk) {
        echo sprintf("- %s: %s -> %s(%s)\n", $fk->CONSTRAINT_NAME, $fk->COLUMN_NAME, $fk->REFERENCED_TABLE_NAME, $fk->REFERENCED_COLUMN_NAME);
    }
} catch (\Exception $e) {
    echo "Error fetching FKs: " . $e->getMessage() . "\n";
}

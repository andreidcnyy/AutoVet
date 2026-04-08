<?php
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$results = DB::select("
    SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'appointments'
    AND TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME IS NOT NULL
");

echo "Foreign Keys on 'appointments':\n";
foreach ($results as $row) {
    echo "Constraint: {$row->CONSTRAINT_NAME} | Column: {$row->COLUMN_NAME} | References: {$row->REFERENCED_TABLE_NAME}({$row->REFERENCED_COLUMN_NAME})\n";
}

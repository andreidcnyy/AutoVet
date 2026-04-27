<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$counts = DB::table('invoices')
    ->select(DB::raw("YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as count"))
    ->groupBy('year', 'month')
    ->orderBy('year', 'desc')
    ->orderBy('month', 'desc')
    ->get();

echo "Invoice Date Distribution:\n";
foreach ($counts as $row) {
    echo "Year: {$row->year}, Month: {$row->month}, Count: {$row->count}\n";
}

<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Services\ServiceForecastAggregator;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

// Mock auth for clinic_id
$user = User::first();
Auth::login($user);

$aggregator = new ServiceForecastAggregator();
$data = $aggregator->getMonthlyData();

echo "Aggregated Monthly Data:\n";
foreach ($data as $row) {
    echo "Month: {$row['month']}, Total Services: {$row['total_services']}, Revenue: {$row['estimated_revenue']}\n";
}

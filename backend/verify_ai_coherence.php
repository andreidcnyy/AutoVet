<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Http\Controllers\DashboardController;
use Illuminate\Http\Request;

function checkRange($controller, $rangeLabel, $expectedPoints) {
    echo "--- CHECKING RANGE: {$rangeLabel} ---\n";
    $request = new Request(['range' => $rangeLabel]);
    try {
        $response = $controller->getSalesForecast($request);
        $data = $response->getData(true);

        echo "Status: SUCCESS\n";
        echo "Prediction Source: " . ($data['prediction_source'] ?? 'UNKNOWN') . "\n";
        echo "Is Dataset Fallback: " . ($data['is_dataset_prediction'] ? 'YES' : 'NO') . "\n";
        
        $chart = $data['data'] ?? [];
        echo "Chart Points: " . count($chart) . " (Expected: {$expectedPoints})\n";

        if (count($chart) === $expectedPoints) {
            $actuals = array_filter($chart, fn($p) => $p['actual'] !== null);
            $forecasts = array_filter($chart, fn($p) => $p['actual'] === null);
            
            echo "- Actuals count: " . count($actuals) . "\n";
            echo "- Forecasts count: " . count($forecasts) . " (Expected: 2)\n";
            
            $months = array_column($chart, 'month');
            echo "- Months sequence: " . implode(', ', $months) . "\n";
        } else {
            echo "POINT MISMATCH! Got " . count($chart) . "\n";
        }

        echo "Slope: " . ($data['model']['slope'] ?? 'N/A') . "\n";
        echo "----------------------------------------\n\n";

    } catch (\Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
    }
}

echo "--- AI SALES FORECAST RANGE VERIFICATION ---\n";

$controller = app(DashboardController::class);

checkRange($controller, '6 Months', 8);
checkRange($controller, 'Year', 14);

echo "--- VERIFICATION COMPLETE ---\n";

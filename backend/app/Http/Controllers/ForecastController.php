<?php

namespace App\Http\Controllers;

use App\Services\ServiceForecastAggregator;
use App\Services\PythonForecastRunner;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ForecastController extends Controller
{
    protected $aggregator;
    protected $runner;

    public function __construct(ServiceForecastAggregator $aggregator, PythonForecastRunner $runner)
    {
        $this->aggregator = $aggregator;
        $this->runner = $runner;
    }

    /**
     * Get historical service forecast data.
     * Exposes endpoint: GET /api/forecast/services/history
     */
    public function history(Request $request): JsonResponse
    {
        try {
            $historical = $this->aggregator->getMonthlyData();
            
            // Clean up revenue fields that were added for pricing computation
            $cleaned = array_map(function ($row) {
                return [
                    'month' => $row['month'],
                    'consultation' => $row['consultation'],
                    'grooming' => $row['grooming'],
                    'vaccination' => $row['vaccination'],
                    'laboratory' => $row['laboratory'],
                    'others' => $row['others'],
                    'total_services' => $row['total_services'],
                    'estimated_customers' => $row['estimated_customers'],
                    'estimated_revenue' => $row['estimated_revenue']
                ];
            }, $historical);

            return response()->json($cleaned);
        } catch (\Exception $e) {
            Log::error("Service Forecast History API Error: " . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get full service forecast data (historical + predicted).
     */
    public function services(): JsonResponse
    {
        try {
            $clinicId = auth()->user()->clinic_id;
            $cacheKey = "service_forecast_v8_clinic_{$clinicId}";

            $result = Cache::remember($cacheKey, 3600, function () {
                $aggregator = new ServiceForecastAggregator();
                $historical = $aggregator->getMonthlyData();

                if (count($historical) < 2) {
                    return [
                        'historical' => $historical,
                        'forecast'   => [],
                        'model_info' => [
                            'warning' => 'Insufficient data. Run dataset seeder first.'
                        ],
                    ];
                }

                $runner   = new PythonForecastRunner();
                $forecast = $runner->runServiceForecast($historical, 6);

                return [
                    'historical' => $historical,
                    'forecast'   => $forecast['forecast'],   // includes by_category per month
                    'model_info' => $forecast['model_info'],
                ];
            });

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Forecast failed: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Forecast temporarily unavailable.',
                'details' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }
}

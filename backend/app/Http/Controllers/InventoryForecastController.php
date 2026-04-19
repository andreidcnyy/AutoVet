<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\InventoryForecast;
use App\Services\InventoryForecastService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class InventoryForecastController extends Controller
{
    protected $inventoryForecastService;

    public function __construct(InventoryForecastService $inventoryForecastService)
    {
        $this->inventoryForecastService = $inventoryForecastService;
    }

    /**
     * Get inventory stockout forecast for a specific inventory item.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Inventory  $inventory
     * @return \Illuminate\Http\JsonResponse
     */
    public function forecast(Request $request, Inventory $inventory): JsonResponse
    {
        // Validate request, e.g., ensure history_days is an integer
        $request->validate([
            'history_days' => 'sometimes|integer|min:7|max:365',
        ]);

        $historyDays = $request->query('history_days', 30);

        $forecast = $this->inventoryForecastService->getStockoutForecast(
            $inventory->id,
            $historyDays
        );

        if (isset($forecast['error'])) {
            return response()->json(['message' => $forecast['error']], 400);
        }

        return response()->json($forecast);
    }

    /**
     * Return all past forecasts for an inventory item, newest first.
     * Supports audit trail and prediction drift analysis.
     *
     * GET /inventory/{inventory}/forecast/history
     */
    public function forecastHistory(Request $request, Inventory $inventory): JsonResponse
    {
        $request->validate([
            'limit' => 'sometimes|integer|min:1|max:100',
        ]);

        $limit     = (int) $request->query('limit', 20);
        $forecasts = $this->inventoryForecastService->getForecastHistory($inventory->id, $limit);

        return response()->json([
            'inventory_id' => $inventory->id,
            'item_name'    => $inventory->item_name,
            'total'        => $forecasts->count(),
            'forecasts'    => $forecasts->map(fn ($f) => [
                'id'                         => $f->id,
                'predicted_demand'           => $f->predicted_demand,
                'days_until_stockout'        => $f->days_until_stockout,
                'predicted_stockout_date'    => $f->predicted_stockout_date,
                'suggested_reorder_quantity' => $f->suggested_reorder_quantity,
                'generated_at'               => $f->generated_at,
                'model_used'                 => $f->model_used,
                'notes'                      => $f->notes,
            ]),
        ]);
    }

    /**
     * Return the latest persisted forecast for an inventory item from inventory_forecasts.
     * This avoids live Python execution and is suitable for dashboard polling.
     *
     * GET /inventory/{inventory}/forecast/saved
     */
    public function savedForecast(Inventory $inventory): JsonResponse
    {
        $forecast = $this->inventoryForecastService->getLatestSavedForecast($inventory->id);

        if (!$forecast) {
            return response()->json([
                'inventory_id'               => $inventory->id,
                'item_name'                  => $inventory->item_name,
                'predicted_demand'           => 0,
                'days_until_stockout'        => null,
                'predicted_stockout_date'    => null,
                'suggested_reorder_quantity' => null,
                'generated_at'               => null,
                'model_used'                 => null,
                'notes'                      => null,
                'prediction_status'          => 'No Forecast Available',
                'average_daily_consumption'  => 0,
                'predicted_monthly_sales'    => 0,
                'message'                    => 'No saved forecast exists for this item yet. Trigger a forecast refresh or finalize an invoice containing this item.',
            ]);
        }

        // DYNAMIC RE-CALCULATION:
        // We MUST adjust the days/dates to the LIVE stock level.
        $currentStock = $inventory->stock_level;
        $minStock = $inventory->min_stock_level ?? 0;
        $avgDaily = $forecast->average_daily_consumption ?? 0;

        $daysLeft = null;
        $predictedDate = null;
        $status = 'Safe';
        $message = $forecast->notes ?? 'AI forecast successfully retrieved.';

        if ($avgDaily > 0) {
            $daysLeft = ($currentStock > $minStock) ? ceil(($currentStock - $minStock) / $avgDaily) : 0;
            $predictedDate = now()->addDays($daysLeft)->format('Y-m-d');
            $status = ($daysLeft < 7) ? 'Critical' : (($daysLeft < 14) ? 'Reorder Soon' : 'Safe');
            
            // Override message if it was "Critical" but stock is now healthy
            if ($currentStock > $minStock && (strpos($message, 'at or below minimum') !== false || strpos($message, 'out of stock') !== false)) {
                $message = "Demand analysis indicates stock is currently healthy based on recent usage rates.";
            }
        } elseif ($currentStock <= $minStock) {
            $daysLeft = 0;
            $predictedDate = now()->format('Y-m-d');
            $status = 'Critical';
            $message = "Stock is currently at or below minimum level.";
        }

        return response()->json([
            'inventory_id'               => $forecast->inventory_id,
            'item_name'                  => $inventory->item_name,
            'predicted_demand'           => $avgDaily,
            'days_until_stockout'        => $daysLeft,
            'predicted_stockout_date'    => $predictedDate,
            'suggested_reorder_quantity' => $forecast->suggested_reorder_quantity,
            'generated_at'               => $forecast->generated_at,
            'model_used'                 => $forecast->model_used,
            'notes'                      => $message,
            'message'                    => $message,
            'forecast_status'            => $status,
            'prediction_status'          => $forecast->prediction_source === 'dataset' 
                                            ? 'Using dataset-based prediction' 
                                            : ($forecast->forecast_status === 'Insufficient Data' ? 'Insufficient Data' : 'Synced Dataset Insight'),
            'average_daily_consumption'  => $avgDaily,
            'predicted_daily_sales'      => $forecast->predicted_daily_sales,
            'predicted_weekly_sales'     => round($avgDaily * 7, 2),
            'predicted_monthly_sales'    => round($avgDaily * 30, 2), // Strictly recalculated
            'estimated_monthly_revenue'  => $forecast->estimated_monthly_revenue,
            'prediction_source'          => $forecast->prediction_source,
            'is_live_synced'             => true,
            'current_stock'              => $currentStock,
            'min_stock_level'            => $minStock
        ]);
    }
}

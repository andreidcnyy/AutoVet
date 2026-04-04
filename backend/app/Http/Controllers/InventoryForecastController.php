<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
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
}

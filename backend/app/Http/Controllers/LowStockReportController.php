<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Inventory;
use Illuminate\Support\Facades\Response;

class LowStockReportController extends Controller
{
    /**
     * Generate a low stock report (JSON or CSV).
     */
    public function generate(Request $request)
    {
        $query = Inventory::whereRaw('stock_level <= min_stock_level');

        // Optional logic for filtering:
        if ($request->has('supplier')) {
            $query->where('supplier', $request->query('supplier'));
        }

        $items = $query->select(['item_name', 'sku', 'stock_level', 'min_stock_level', 'supplier', 'expiration_date'])->get();

        $format = $request->query('format', 'json');

        if ($format === 'csv') {
            $csvData = "Item Name,SKU,Current Stock,Minimum Threshold,Supplier,Expiration Date\n";
            foreach ($items as $item) {
                $csvData .= sprintf(
                    '"%s","%s",%d,%d,"%s","%s"' . "\n",
                    $item->item_name,
                    $item->sku,
                    $item->stock_level,
                    $item->min_stock_level,
                    $item->supplier,
                    $item->expiration_date
                );
            }

            return Response::make($csvData, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="low_stock_report.csv"',
            ]);
        }

        // Return JSON by default
        return response()->json($items);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryForecast extends Model
{
    protected $table = 'inventory_forecasts';

    protected $fillable = [
        'inventory_id',
        'predicted_demand',
        'average_daily_consumption',
        'days_until_stockout',
        'predicted_stockout_date',
        'suggested_reorder_quantity',
        'forecast_status',
        'generated_at',
        'model_used',
        'notes',
        'predicted_daily_sales',
        'predicted_weekly_sales',
        'predicted_monthly_sales',
        'prediction_source',
        'trigger_source',
        'estimated_monthly_revenue',
    ];

    protected $casts = [
        'predicted_demand'          => 'decimal:2',
        'average_daily_consumption' => 'decimal:2',
        'predicted_stockout_date'   => 'date',
        'generated_at'              => 'datetime',
        'predicted_daily_sales'     => 'decimal:2',
        'predicted_weekly_sales'    => 'decimal:2',
        'predicted_monthly_sales'   => 'decimal:2',
        'estimated_monthly_revenue' => 'decimal:2',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }
}

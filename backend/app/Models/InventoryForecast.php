<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryForecast extends Model
{
    protected $table = 'inventory_forecasts';

    protected $fillable = [
        'inventory_id',
        'predicted_demand',
        'days_until_stockout',
        'predicted_stockout_date',
        'suggested_reorder_quantity',
        'generated_at',
        'model_used',
        'notes',
    ];

    protected $casts = [
        'predicted_demand'        => 'decimal:2',
        'predicted_stockout_date' => 'date',
        'generated_at'            => 'datetime',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }
}

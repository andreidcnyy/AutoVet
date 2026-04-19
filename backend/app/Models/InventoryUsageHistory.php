<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryUsageHistory extends Model
{
    protected $table = 'inventory_usage_history';

    /**
     * Source types that represent true verified consumption and are safe to use
     * as AI forecast input. Excludes manual adjustments and non-sale events.
     */
    public const FORECASTING_SAFE_SOURCES = ['retail_sale', 'service_consumable', 'manual_adjustment'];

    protected $fillable = [
        'inventory_id',
        'invoice_id',
        'invoice_item_id',
        'quantity_used',
        'usage_date',
        'source_type',
        'unit_price',
    ];

    protected $casts = [
        'quantity_used' => 'decimal:2',
        'unit_price'    => 'decimal:2',
        'usage_date'    => 'date',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function invoiceItem()
    {
        return $this->belongsTo(InvoiceItem::class);
    }

    /**
     * Scope: only rows that represent verified sales consumption.
     * Use this on every query that feeds forecast input.
     */
    public function scopeForecastingSafe($query)
    {
        return $query->whereIn('source_type', self::FORECASTING_SAFE_SOURCES);
    }
}

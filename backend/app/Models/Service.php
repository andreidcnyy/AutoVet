<?php

namespace App\Models;

use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use SoftDeletes, HasSyncFields;
    protected $fillable = [
        'name',
        'description',
        'price',
        'pricing_mode', // Legacy
        'pricing_type',
        'measurement_basis',
        'base_price',
        'category',
        'status',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function sizePrices()
    {
        return $this->hasMany(ServicePrice::class);
    }

    public function pricingRules()
    {
        return $this->hasMany(ServicePricingRule::class);
    }
}

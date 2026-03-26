<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    use SoftDeletes;
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

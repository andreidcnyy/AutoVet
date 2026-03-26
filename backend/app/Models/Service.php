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
        'pricing_mode',
        'category',
        'status',
    ];

    public function sizePrices()
    {
        return $this->hasMany(ServicePrice::class);
    }
}

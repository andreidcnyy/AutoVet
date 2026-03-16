<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    protected $fillable = [
        'item_name',
        'sub_details',
        'category',
        'sku',
        'stock_level',
        'status',
        'price',
        'supplier',
        'expiration_date',
        'min_stock_level'
    ];
}

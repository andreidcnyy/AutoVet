<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Inventory extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'item_name',
        'sub_details',
        'category',
        'sku',
        'stock_level',
        'status',
        'price',
        'selling_price',
        'supplier',
        'expiration_date',
        'min_stock_level',
        'is_billable',
        'is_consumable',
        'deduct_on_finalize'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'is_billable' => 'boolean',
        'is_consumable' => 'boolean',
        'deduct_on_finalize' => 'boolean',
        'expiration_date' => 'date',
    ];

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }
}

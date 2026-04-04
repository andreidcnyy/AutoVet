<?php

namespace App\Models;

use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Inventory extends Model
{
    use SoftDeletes, HasSyncFields;
    protected $fillable = [
        'item_name',
        'sub_details',
        'inventory_category_id',
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
        'deduct_on_finalize',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'price'                    => 'decimal:2',
        'selling_price'            => 'decimal:2',
        'is_billable'              => 'boolean',
        'is_consumable'            => 'boolean',
        'deduct_on_finalize'       => 'boolean',
        'expiration_date'          => 'date',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function inventoryCategory()
    {
        return $this->belongsTo(InventoryCategory::class, 'inventory_category_id');
    }
}

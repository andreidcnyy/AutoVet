<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    use SoftDeletes, HasSyncFields, Archivable;
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
        // Archive tracking
        'deleted_by', 'restore_until',
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

    public function preventPermanentDeletionIfReferenced()
    {
        if (DB::table('invoice_items')->where('item_type', 'inventory')->where('item_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this inventory item because it is referenced in past invoices.");
        }
        if ($this->transactions()->exists()) {
            throw new \Exception("Cannot permanently delete this inventory item because it has a recorded transaction ledger.");
        }
    }
}

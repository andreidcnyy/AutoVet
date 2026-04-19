<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Inventory extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail;
    protected $fillable = [
        'item_name',
        'unit',
        'code',
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
        'is_sellable',
        'is_service_usable',
        'deduct_on_finalize',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $appends = ['stock_status'];

    protected $casts = [
        'stock_level'              => 'integer',
        'min_stock_level'          => 'integer',
        'price'                    => 'decimal:2',
        'selling_price'            => 'decimal:2',
        'is_sellable'              => 'boolean',
        'is_service_usable'        => 'boolean',
        'deduct_on_finalize'       => 'boolean',
        'expiration_date'          => 'date',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function ($inventory) {
            $inventory->status = $inventory->calculateStockStatus();
        });
    }

    /**
     * Calculate status string based on numeric stock levels.
     */
    public function calculateStockStatus(): string
    {
        if ($this->stock_level <= 0) {
            return 'Out of Stock';
        }
        
        if ($this->stock_level <= ($this->min_stock_level ?? 0)) {
            return 'Low Stock';
        }

        return 'In Stock';
    }

    /**
     * Virtual attribute for standardized logic-friendly status.
     */
    public function getStockStatusAttribute(): string
    {
        if ($this->stock_level <= 0) return 'out_of_stock';
        if ($this->stock_level <= ($this->min_stock_level ?? 0)) return 'low_stock';
        return 'in_stock';
    }

    public function transactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function inventoryCategory()
    {
        return $this->belongsTo(InventoryCategory::class, 'inventory_category_id');
    }

    public function forecasts()
    {
        return $this->hasMany(InventoryForecast::class);
    }

    public function latestForecast()
    {
        return $this->hasOne(InventoryForecast::class)->latestOfMany('generated_at');
    }

    /**
     * Determine if this inventory item has only its auto-created initial stock transaction.
     */
    public function hasOnlyInitialStockTransaction(): bool
    {
        $count = $this->transactions()->count();
        if ($count === 0) return true;
        if ($count > 1) return false;
        
        $tx = $this->transactions()->first();
        return $tx->transaction_type === 'Stock In' && $tx->remarks === 'Initial Stock';
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if (DB::table('invoice_items')->where('inventory_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this inventory item because it is referenced in past invoices.");
        }
        
        if (!$this->hasOnlyInitialStockTransaction()) {
            throw new \Exception("This item cannot be permanently deleted because it already has inventory activity beyond its initial stock entry.");
        }
    }
}

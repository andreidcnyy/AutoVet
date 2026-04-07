<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Service extends Model
{
    use SoftDeletes, HasSyncFields, Archivable;
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
        // Archive tracking
        'deleted_by', 'restore_until',
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

    public function consumables()
    {
        return $this->hasMany(ServiceConsumable::class);
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if (DB::table('invoice_items')->where('service_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this service because it is referenced in past invoices.");
        }
        if (DB::table('appointments')->where('service_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this service because it is referenced in past appointments.");
        }
    }
}

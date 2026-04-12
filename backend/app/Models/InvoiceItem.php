<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class InvoiceItem extends Model
{
    use HasSyncFields, HasAuditTrail;

    protected $guarded = [];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inventory_id');
    }
}

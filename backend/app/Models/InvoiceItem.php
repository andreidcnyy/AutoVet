<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasClinic;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class InvoiceItem extends Model
{
    use HasSyncFields, HasAuditTrail, HasClinic;

    protected static function booted(): void
    {
        static::creating(function (InvoiceItem $item) {
            if (!$item->clinic_id && $item->invoice_id) {
                $invoiceClinicId = Invoice::withoutGlobalScopes()
                    ->whereKey($item->invoice_id)
                    ->value('clinic_id');
                if ($invoiceClinicId) {
                    $item->clinic_id = $invoiceClinicId;
                }
            }
        });
    }

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

<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasSyncFields, HasAuditTrail;

    protected $guarded = [];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function appointment()
    {
        return $this->belongsTo(Appointment::class);
    }
}

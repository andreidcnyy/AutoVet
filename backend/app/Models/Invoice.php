<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasSyncFields, HasAuditTrail;

    protected $guarded = [];

    protected $appends = ['formatted_amount_paid'];

    public function getFormattedAmountPaidAttribute()
    {
        // For seeders where amount_paid is 0 but status is Paid/Finalized
        if ($this->amount_paid <= 0 && in_array($this->status, ['Paid', 'Finalized'])) {
            return (float) $this->total;
        }
        return (float) $this->amount_paid;
    }

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

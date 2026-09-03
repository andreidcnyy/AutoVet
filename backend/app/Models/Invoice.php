<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class Invoice extends Model
{
    use HasSyncFields, HasAuditTrail, HasClinic;

    /** The VAT rate these prices already include. */
    public const VAT_RATE = 0.12;

    /**
     * The VAT contained inside a VAT-inclusive amount.
     *
     * Line prices already carry the 12%, so the tax is a portion of the gross
     * (rate / (1 + rate)), not an addition to it. Adding 12% on top charged
     * the customer the tax twice.
     */
    public static function vatPortionOf(float $grossAmount): float
    {
        return round($grossAmount * (self::VAT_RATE / (1 + self::VAT_RATE)), 2);
    }

    /** The VAT contained in this invoice total. */
    public function getVatAmountAttribute(): float
    {
        return self::vatPortionOf((float) $this->total);
    }

    /** This invoice total excluding the VAT it already contains. */
    public function getNetOfVatAttribute(): float
    {
        return round((float) $this->total - $this->vat_amount, 2);
    }

    protected $fillable = [
        'invoice_number', 'pet_id', 'appointment_id', 'service_date', 'report_type', 'status',
        'subtotal', 'discount_type', 'discount_value', 'tax_rate', 'total',
        'amount_paid', 'payment_method', 'notes_to_client', 'clinic_id',
    ];

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

    public function review()
    {
        return $this->hasOne(Review::class);
    }
}

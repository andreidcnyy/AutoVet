<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $guarded = [];

    public function pet()
    {
        return $this->belongsTo(Pet::class, 'patient_id');
    }

    public function items()
    {
        return $this->hasMany(InvoiceItem::class);
    }
}

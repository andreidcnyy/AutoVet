<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class InventoryTransaction extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id',
        'inventory_id',
        'transaction_type',
        'quantity',
        'previous_stock',
        'new_stock',
        'remarks',
        'created_by'
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }

    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}

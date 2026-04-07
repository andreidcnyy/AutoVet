<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceConsumable extends Model
{
    protected $fillable = ['service_id', 'inventory_id', 'quantity'];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }
}

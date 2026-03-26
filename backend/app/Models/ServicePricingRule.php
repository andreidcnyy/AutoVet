<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServicePricingRule extends Model
{
    protected $fillable = ['service_id', 'basis_type', 'reference_id', 'price'];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}

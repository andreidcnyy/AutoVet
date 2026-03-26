<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServicePrice extends Model
{
    protected $fillable = ['service_id', 'size_class', 'price'];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}

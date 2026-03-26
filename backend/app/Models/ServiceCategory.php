<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceCategory extends Model
{
    protected $table = 'mdm_service_categories';
    protected $fillable = ['name', 'status'];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Owner extends Model
{
    use SoftDeletes;
    
    protected $fillable = [
        'name', 'phone', 'email', 'address', 'city', 'province', 'zip'
    ];

    public function pets()
    {
        return $this->hasMany(Pet::class);
    }
}

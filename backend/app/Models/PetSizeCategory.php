<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PetSizeCategory extends Model
{
    protected $fillable = ['name', 'description', 'status'];

    public function pets()
    {
        return $this->hasMany(Pet::class, 'size_category_id');
    }
}

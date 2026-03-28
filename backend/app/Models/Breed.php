<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Breed extends Model
{
    protected $fillable = ['species_id', 'default_size_category_id', 'name', 'status'];

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function defaultSizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'default_size_category_id');
    }
}

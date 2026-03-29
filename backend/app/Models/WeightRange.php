<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeightRange extends Model
{
    protected $fillable = ['label', 'species_id', 'min_weight', 'max_weight', 'unit', 'size_category_id', 'status', 'pet_size_category_id'];

    public function sizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'size_category_id');
    }

    public function species()
    {
        return $this->belongsTo(Species::class, 'species_id');
    }
}

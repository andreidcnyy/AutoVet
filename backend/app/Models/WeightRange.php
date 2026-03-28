<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeightRange extends Model
{
    protected $fillable = ['label', 'min_weight', 'max_weight', 'unit', 'species_id', 'size_category_id', 'status'];

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function sizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'size_category_id');
    }
}

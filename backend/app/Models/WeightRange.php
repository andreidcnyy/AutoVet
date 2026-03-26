<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeightRange extends Model
{
    protected $fillable = ['label', 'min_weight', 'max_weight', 'unit', 'size_category_id', 'status'];

    public function sizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'size_category_id');
    }
}

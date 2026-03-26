<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeightRange extends Model
{
    protected $fillable = ['label', 'min_weight', 'max_weight', 'unit', 'status'];
}

<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Model;

class Species extends Model
{
    use HasAuditTrail;
    protected $fillable = ['name', 'status'];

    public function breeds()
    {
        return $this->hasMany(Breed::class);
    }

    public function weightRanges()
    {
        return $this->hasMany(WeightRange::class);
    }
}

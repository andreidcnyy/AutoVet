<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class Species extends Model
{
    use HasAuditTrail, HasClinic;
    protected $fillable = ['clinic_id', 'name', 'status'];

    public function breeds()
    {
        return $this->hasMany(Breed::class);
    }

    public function weightRanges()
    {
        return $this->hasMany(WeightRange::class);
    }
}

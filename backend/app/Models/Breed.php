<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class Breed extends Model
{
    use HasAuditTrail, HasClinic;
    protected $fillable = ['clinic_id', 'species_id', 'default_size_category_id', 'name', 'status'];

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function defaultSizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'default_size_category_id');
    }
}

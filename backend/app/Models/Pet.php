<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pet extends Model
{
    use SoftDeletes;
    
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($pet) {
            if ($pet->weight !== null) {
                $range = WeightRange::where('status', 'Active')
                    ->where('min_weight', '<=', $pet->weight)
                    ->where(function ($query) use ($pet) {
                        $query->where('max_weight', '>=', $pet->weight)
                              ->orWhereNull('max_weight');
                    })
                    ->first();

                if ($range) {
                    $pet->size_category_id = $range->size_category_id;
                }
            }
        });
    }

    protected $fillable = [
        'owner_id', 'name', 'species_id', 'breed_id', 'date_of_birth', 'age_group',
        'sex', 'color', 'weight', 'weight_unit', 'size_category_id', 'status',
        'allergies', 'medication', 'notes', 'photo'
    ];

    protected $appends = ['last_visit', 'next_due'];

    public function owner()
    {
        return $this->belongsTo(Owner::class);
    }

    public function species()
    {
        return $this->belongsTo(Species::class);
    }

    public function breed()
    {
        return $this->belongsTo(Breed::class);
    }

    public function sizeCategory()
    {
        return $this->belongsTo(PetSizeCategory::class, 'size_category_id');
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }

    public function medicalRecords()
    {
        return $this->hasMany(MedicalRecord::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function getLastVisitAttribute()
    {
        return $this->appointments()
            ->where('date', '<', now())
            ->orderBy('date', 'desc')
            ->value('date') ?? 'No past visits';
    }

    public function getNextDueAttribute()
    {
        return $this->appointments()
            ->where('date', '>=', now())
            ->orderBy('date', 'asc')
            ->value('date') ?? 'None scheduled';
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pet extends Model
{
    use SoftDeletes;
    
    protected $fillable = [
        'owner_id', 'name', 'species_id', 'breed_id', 'date_of_birth',
        'gender', 'color', 'weight_value', 'weight_unit', 'status',
        'size_class', 'allergies', 'medication', 'notes', 'photo'
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

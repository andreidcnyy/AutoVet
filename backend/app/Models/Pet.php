<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pet extends Model
{
    use SoftDeletes, HasSyncFields, Archivable;
    
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($pet) {
            // When weight and species are both present, weight range MUST be the source of truth
            if ($pet->weight !== null && $pet->species_id !== null) {
                $range = WeightRange::where('status', 'Active')
                    ->where('species_id', $pet->species_id)
                    ->where('min_weight', '<=', $pet->weight)
                    ->where(function ($query) use ($pet) {
                        $query->where('max_weight', '>=', $pet->weight)
                              ->orWhereNull('max_weight');
                    })
                    ->first();

                if ($range && $range->size_category_id) {
                    $pet->size_category_id = $range->size_category_id;
                } else {
                    // If no active range matches this weight, we should probably clear the size category
                    // to prevent contradictory data from manual entry.
                    $pet->size_category_id = null;
                }
            }
        });
    }

    protected $fillable = [
        'owner_id', 'name', 'species_id', 'breed_id', 'date_of_birth', 'age_group',
        'sex', 'color', 'weight', 'weight_unit', 'size_category_id', 'status',
        'allergies', 'medication', 'notes', 'photo',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
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

    public function preventPermanentDeletionIfReferenced()
    {
        if ($this->medicalRecords()->exists() || $this->invoices()->exists()) {
            throw new \Exception("Cannot permanently delete this pet because it is referenced by existing medical records or invoices.");
        }
    }
}

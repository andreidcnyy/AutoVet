<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Models\WeightRange;
use App\Models\Species;
use App\Models\PetSizeCategory;
use App\Models\Breed;
use App\Models\Appointment;
use App\Models\MedicalRecord;
use App\Models\Invoice;

class Pet extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail;
    
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($pet) {
            // 1. Auto-compute Size Category from Weight
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
                    $pet->size_category_id = null;
                }
            }

            // 2. Auto-compute Age Group from species and DOB
            if ($pet->date_of_birth !== null && $pet->species_id !== null) {
                try {
                    $dob = Carbon::parse($pet->date_of_birth);
                    $now = now();
                    $ageInMonths = $dob->diffInMonths($now);
                    
                    $species = Species::find($pet->species_id);
                    $speciesName = $species ? $species->name : 'Default';
                    
                    // Define thresholds (in months)
                    $thresholds = [
                        'Canine' => ['Baby' => 5, 'Young' => 11, 'Adult' => 72],
                        'Feline' => ['Baby' => 5, 'Young' => 11, 'Adult' => 108],
                        'Rabbit' => ['Baby' => 3, 'Young' => 11, 'Adult' => 48],
                        'Bird'   => ['Baby' => 3, 'Young' => 11, 'Adult' => 84],
                        'Default'=> ['Baby' => 6, 'Young' => 12, 'Adult' => 84],
                    ];
                    
                    $t = $thresholds[$speciesName] ?? $thresholds['Default'];
                    
                    if ($ageInMonths <= $t['Baby']) {
                        $pet->age_group = 'Baby';
                    } elseif ($ageInMonths <= $t['Young']) {
                        $pet->age_group = 'Young';
                    } elseif ($ageInMonths <= $t['Adult']) {
                        $pet->age_group = 'Adult';
                    } else {
                        $pet->age_group = 'Senior';
                    }
                } catch (\Exception $e) {
                    $pet->age_group = null;
                }
            } else {
                $pet->age_group = null;
            }
        });
    }

    protected $fillable = [
        'owner_id', 'name', 'species_id', 'breed_id', 'date_of_birth', 'age_group',
        'sex', 'color', 'weight', 'weight_unit', 'size_category_id', 'status',
        'allergies', 'medication', 'notes', 'photo',
        'chief_complaint', 'findings', 'diagnosis', 'treatment_plan', 'vet_id',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $appends = [
        // 'total_paid', 'total_due', 'last_visit', 'next_due' - removed to improve list performance
    ];

    public function getTotalPaidAttribute()
    {
        // Use the loaded relationship if available to avoid N+1 queries
        $invoices = $this->relationLoaded('invoices') ? $this->invoices : $this->invoices()->get();

        return $invoices
            ->whereIn('status', ['Paid', 'Partially Paid', 'Finalized'])
            ->sum(function($invoice) {
                return (float) ($invoice->formatted_amount_paid ?? $invoice->amount_paid ?? 0);
            });
    }

    public function getTotalDueAttribute()
    {
        $invoices = $this->relationLoaded('invoices') ? $this->invoices : $this->invoices()->get();
        return $invoices->sum('total');
    }

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

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

    // Accessor for last visit
    public function getLastVisitAttribute()
    {
        if ($this->relationLoaded('appointments')) {
            return $this->appointments
                ->where('date', '<', now()->toDateString())
                ->sortByDesc('date')
                ->first()?->date ?? 'No past visits';
        }

        return $this->appointments()
            ->where('date', '<', now()->toDateString())
            ->orderBy('date', 'desc')
            ->value('date') ?? 'No past visits';
    }

    // Accessor for next due
    public function getNextDueAttribute()
    {
        if ($this->relationLoaded('appointments')) {
            return $this->appointments
                ->where('date', '>=', now()->toDateString())
                ->sortBy('date')
                ->first()?->date ?? 'None scheduled';
        }

        return $this->appointments()
            ->where('date', '>=', now()->toDateString())
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

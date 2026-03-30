<?php

namespace App\Models;

use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;

class MedicalRecord extends Model
{
    use HasSyncFields;

    protected $fillable = [
        'pet_id', 'vet_id', 'chief_complaint', 'findings',
        'diagnosis', 'treatment_plan', 'notes', 'follow_up_date',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'follow_up_date'           => 'date',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function vet()
    {
        return $this->belongsTo(User::class, 'vet_id');
    }
}

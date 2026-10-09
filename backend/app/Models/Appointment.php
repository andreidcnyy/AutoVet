<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Traits\HasClinic;

class Appointment extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail, HasClinic;

    /**
     * The one definition of what each status means, shared by the calendar,
     * the appointment list and every dashboard tracker so they cannot drift.
     *
     * Both spellings are listed because the column holds a mix of cases, and
     * TiDB (production) compares case-sensitively while local MySQL does not.
     * Capitalised 'Completed' and 'Scheduled' are seeded mock history and are
     * deliberately left out, matching what the calendar has always hidden.
     */
    public const ACTIVE_STATUSES = [
        'Pending', 'pending', 'Approved', 'approved', 'completed', 'no_show',
    ];

    public const CANCELLED_STATUSES = [
        'Cancelled', 'cancelled', 'Declined', 'declined', 'Declined (System)', 'Rejected',
    ];

    public const VISIBLE_STATUSES = [...self::ACTIVE_STATUSES, ...self::CANCELLED_STATUSES];

    protected $fillable = [
        'clinic_id',
        'title',
        'date',
        'time',
        'category',
        'notes',
        'decline_reason',
        'status',
        'is_walk_in',
        'pet_id',
        'service_id',
        'vet_id',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'is_walk_in'               => 'boolean',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function pet()
    {
        return $this->belongsTo(Pet::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function services()
    {
        return $this->belongsToMany(Service::class, 'appointment_services');
    }

    public function vet()
    {
        return $this->belongsTo(Admin::class, 'vet_id');
    }

    public function medicalRecords()
    {
        return $this->hasMany(MedicalRecord::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}

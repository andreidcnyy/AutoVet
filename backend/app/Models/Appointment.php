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

    /**
     * How many approved appointments one time slot can hold. Once a slot has
     * this many, it disappears from the portal and cannot be booked, approved
     * into, or rescheduled into.
     */
    public const SLOT_CAPACITY = 2;

    /**
     * The time column is a string holding "9:00", "09:00" and "09:00:00" alike,
     * so slots are compared on a normalised HH:MM rather than the raw value.
     */
    public static function normaliseSlotTime($time): string
    {
        $ts = strtotime((string) $time);
        return $ts === false ? (string) $time : date('H:i', $ts);
    }

    /**
     * Approved appointments already holding the given date and time.
     */
    public static function approvedCountAt(string $date, $time, ?int $exceptId = null): int
    {
        $slot = self::normaliseSlotTime($time);

        return self::whereDate('date', $date)
            ->whereRaw('LOWER(status) = ?', ['approved'])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->pluck('time')
            ->filter(fn ($t) => self::normaliseSlotTime($t) === $slot)
            ->count();
    }

    public static function slotIsFull(string $date, $time, ?int $exceptId = null): bool
    {
        return self::approvedCountAt($date, $time, $exceptId) >= self::SLOT_CAPACITY;
    }

    /**
     * Runs $callback while holding a lock on one date and time, so two bookings
     * or approvals made at the same moment cannot both squeeze into the last
     * place in a slot.
     */
    public static function withSlotLock(string $date, $time, callable $callback)
    {
        $key = 'appointment-slot:' . date('Y-m-d', strtotime($date)) . ':' . self::normaliseSlotTime($time);

        return \Illuminate\Support\Facades\Cache::lock($key, 10)->block(5, $callback);
    }

    public static function slotFullMessage(): string
    {
        return 'This time slot is already full (' . self::SLOT_CAPACITY . ' approved appointments). Please choose another time.';
    }

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

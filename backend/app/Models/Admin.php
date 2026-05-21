<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use Laravel\Sanctum\HasApiTokens;
use App\Enums\Roles;
use Illuminate\Support\Facades\DB;

use App\Traits\HasClinic;

class Admin extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, Archivable, HasAuditTrail, HasClinic;

    protected $table = 'admins';

    protected $fillable = [
        'clinic_id',
        'name',
        'email',
        'password',
        'role',
        'avatar',
        'status',
        'must_change_password',
        'ai_features_enabled',
        'deleted_by',
        'restore_until',
        'last_seen_patients_at',
        'last_seen_appointments_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'deleted_by',
        'restore_until',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'           => 'datetime',
            'must_change_password'        => 'boolean',
            'ai_features_enabled'         => 'boolean',
            'last_seen_patients_at'       => 'datetime',
            'last_seen_appointments_at'   => 'datetime',
        ];
    }

    public function hasRole(string ...$roles): bool
    {
        return in_array($this->role, $roles);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Roles::CLINIC_ADMIN->value);
    }

    public function isFullAdmin(): bool
    {
        return $this->hasRole(...Roles::adminRoles());
    }

    public function isClinical(): bool
    {
        return $this->hasRole(...Roles::clinicalRoles());
    }

    public function isStaff(): bool
    {
        return $this->hasRole(Roles::STAFF->value);
    }

    public function isOwner(): bool
    {
        return false;
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if (DB::table('appointments')->where('vet_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this user because they are assigned to past or upcoming appointments.");
        }
        if (DB::table('vet_schedules')->where('user_id', $this->id)->exists()) {
            throw new \Exception("Cannot permanently delete this user because they have recorded work schedules.");
        }
    }
}

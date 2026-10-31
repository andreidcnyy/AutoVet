<?php

namespace App\Models;

use App\Enums\Roles;
use App\Traits\HasAuditTrail;
use App\Traits\HasClinic;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class PortalUser extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasAuditTrail, HasClinic, HasFactory, Notifiable, SoftDeletes;

    protected $table = 'portal_users';

    protected $fillable = [
        'clinic_id',
        'name',
        'email',
        'phone',
        'address',
        'city',
        'province',
        'zip',
        'password',
        'status',
        'email_verified_at',
        'avatar',
        'google_id',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'deletion_requested_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
        'deletion_requested_at',
        'deleted_by',
    ];

    public function owner()
    {
        return $this->hasOne(Owner::class, 'user_id');
    }

    public function hasRole(string ...$roles): bool
    {
        return in_array(Roles::OWNER->value, $roles);
    }

    public function isAdmin(): bool
    {
        return false;
    }

    public function isFullAdmin(): bool
    {
        return false;
    }

    public function isClinical(): bool
    {
        return false;
    }

    public function isOwner(): bool
    {
        return true;
    }
}

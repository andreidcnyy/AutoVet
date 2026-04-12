<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use App\Enums\Roles;

class PortalUser extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasAuditTrail;

    protected $table = 'portal_users';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'address',
        'city',
        'province',
        'zip',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
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

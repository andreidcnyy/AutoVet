<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Archivable;
use Laravel\Sanctum\HasApiTokens;
use App\Enums\Roles;
use Illuminate\Support\Facades\DB;

/**
 * User Proxy Class
 * 
 * Satisfies Laravel framework dependencies while using our new 'admins' table.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, Archivable;

    protected $table = 'admins';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'avatar',
        'status',
        'must_change_password',
        'deleted_by', 
        'restore_until'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'must_change_password' => 'boolean',
        ];
    }

    public function hasRole(string ...$roles): bool
    {
        return in_array($this->role, $roles);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Roles::ADMIN->value);
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
}

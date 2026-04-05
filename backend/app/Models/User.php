<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\Archivable;
use Laravel\Sanctum\HasApiTokens;
use App\Enums\Roles;
use Illuminate\Support\Facades\DB;


class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, Archivable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
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

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Check if user has a specific role (exact match).
     */
    public function hasRole(string ...$roles): bool
    {
        return in_array($this->role, $roles);
    }

    /**
     * Is the user an Admin?
     */
    public function isAdmin(): bool
    {
        return $this->hasRole(Roles::ADMIN->value);
    }

    /**
     * Is the user an Admin (Full permissions)?
     */
    public function isFullAdmin(): bool
    {
        return $this->hasRole(...Roles::adminRoles());
    }

    /**
     * Is the user clinical staff (Veterinarian)?
     */
    public function isClinical(): bool
    {
        return $this->hasRole(...Roles::clinicalRoles());
    }

    /**
     * Is the user general clinic staff?
     */
    public function isStaff(): bool
    {
        return $this->hasRole(Roles::STAFF->value);
    }

    /**
     * Prevent permanent deletion if the user is referenced in other records.
     */
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


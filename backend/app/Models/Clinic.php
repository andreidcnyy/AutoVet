<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Clinic extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'clinic_name',
        'logo',
        'owner_name',
        'email',
        'contact_number',
        'contact_number_2',
        'address',
        'status',
        'subscription_tier',
        'subscription_expires_at',
    ];

    protected $casts = [
        'subscription_expires_at' => 'datetime',
    ];

    public function admins()
    {
        return $this->hasMany(Admin::class);
    }

    public function portalUsers()
    {
        return $this->hasMany(PortalUser::class);
    }

    public function owners()
    {
        return $this->hasMany(Owner::class);
    }

    public function pets()
    {
        return $this->hasMany(Pet::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function inventories()
    {
        return $this->hasMany(Inventory::class);
    }

    public function services()
    {
        return $this->hasMany(Service::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Patient extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name', 'species', 'breed', 'date_of_birth', 'gender',
        'color', 'weight', 'status', 'owner_name', 'owner_phone',
        'owner_email', 'owner_address', 'owner_city', 'owner_province', 'owner_zip',
        'allergies', 'medication', 'notes', 'photo',
    ];

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }
}

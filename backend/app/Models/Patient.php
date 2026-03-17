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

    protected $appends = ['last_visit', 'next_due'];

    public function getLastVisitAttribute()
    {
        return $this->appointments()
            ->where('date', '<', now())
            ->orderBy('date', 'desc')
            ->value('date') ?? 'No past visits';
    }

    public function getNextDueAttribute()
    {
        return $this->appointments()
            ->where('date', '>=', now())
            ->orderBy('date', 'asc')
            ->value('date') ?? 'None scheduled';
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }
}

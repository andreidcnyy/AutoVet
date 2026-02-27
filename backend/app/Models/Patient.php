<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    protected $fillable = [
        'name', 'species', 'breed', 'date_of_birth', 'gender',
        'color', 'weight', 'status', 'owner_name', 'owner_phone',
        'owner_email', 'allergies', 'medication', 'notes', 'photo',
    ];
}

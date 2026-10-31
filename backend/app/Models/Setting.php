<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasAuditTrail, HasClinic;

    protected $fillable = ['clinic_id', 'key', 'value'];
}

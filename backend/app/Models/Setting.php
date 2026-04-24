<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class Setting extends Model
{
    use HasAuditTrail, HasClinic;
    protected $fillable = ['clinic_id', 'key', 'value'];
}

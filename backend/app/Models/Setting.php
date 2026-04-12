<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasAuditTrail;
    protected $fillable = ['key', 'value'];
}

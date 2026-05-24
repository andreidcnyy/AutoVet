<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $fillable = [
        'clinic_id', 'portal_user_id', 'invoice_id',
        'rating', 'title', 'body', 'reviewer_name', 'pet_name',
        'is_approved', 'is_featured',
    ];

    protected $casts = [
        'rating'      => 'integer',
        'is_approved' => 'boolean',
        'is_featured' => 'boolean',
    ];

    public function portalUser()
    {
        return $this->belongsTo(PortalUser::class);
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }
}

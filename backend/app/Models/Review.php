<?php

namespace App\Models;

use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    // Clinic-scoped like the rest of the clinic data: reviews were the one
    // table every clinic admin could list, approve and delete across clinics.
    use HasClinic;

    protected $fillable = [
        'clinic_id', 'portal_user_id', 'invoice_id',
        'rating', 'title', 'body', 'reviewer_name', 'pet_name', 'pet_species',
        'is_approved', 'is_featured',
    ];

    protected $casts = [
        'rating' => 'integer',
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

<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Pet;
use App\Models\PortalUser;

use App\Traits\HasClinic;

class Owner extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail, HasClinic;
    
    protected $fillable = [
        'clinic_id',
        'name', 'phone', 'email', 'address', 'city', 'province', 'zip', 'user_id',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(PortalUser::class, 'user_id');
    }

    public function pets()
    {
        return $this->hasMany(Pet::class);
    }

    public function preventPermanentDeletionIfReferenced()
    {
        if ($this->pets()->exists()) {
            throw new \Exception("Cannot permanently delete this owner because they still have registered pets.");
        }
    }

    /**
     * Excludes seeded mock data (AI training dataset + bulk production mock
     * clients) from the query. The rows stay in the DB so the AI engine can
     * still train on them — they're just hidden from the UI.
     */
    public function scopeRealClients($query)
    {
        return $query
            ->where('email', '!=', 'dataset.seeder@autovet.ai')
            ->where('email', 'not like', 'client.prod.%@autovet.ph');
    }
}

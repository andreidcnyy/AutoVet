<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Owner extends Model
{
    use SoftDeletes, HasSyncFields, Archivable;
    
    protected $fillable = [
        'name', 'phone', 'email', 'address', 'city', 'province', 'zip',
        // Archive tracking
        'deleted_by', 'restore_until',
        // Sync fields
        'uuid', 'sync_status', 'synced_at', 'last_modified_locally_at',
    ];

    protected $casts = [
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
    ];

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
}

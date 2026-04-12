<?php

namespace App\Models;

use App\Traits\Archivable;
use App\Traits\HasAuditTrail;
use App\Traits\HasSyncFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * CmsContent — Website Content Management
 *
 * Stores editable content for the pet-owner web portal:
 * announcements, banners, clinic information blocks, featured services.
 *
 * Records created here are managed locally and will be synced to the
 * cloud server (and the public pet-owner portal) when connectivity is available.
 *
 * Types: announcement | banner | clinic_info | featured_service
 */
class CmsContent extends Model
{
    use SoftDeletes, HasSyncFields, Archivable, HasAuditTrail;

    protected $table = 'cms_contents';

    protected $fillable = [
        'uuid',
        'type',
        'title',
        'body',
        'image_path',
        'is_published',
        'display_order',
        // Archive tracking
        'deleted_by', 
        'restore_until',
        'sync_status',
        'synced_at',
        'last_modified_locally_at',
    ];

    protected $casts = [
        'is_published'             => 'boolean',
        'synced_at'                => 'datetime',
        'last_modified_locally_at' => 'datetime',
        'display_order'            => 'integer',
    ];

    // -------------------------------------------------------------------------
    // Query scopes
    // -------------------------------------------------------------------------

    /** Only published (visible on portal) content. */
    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    /** Filter by content type. */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /** Ordered by display_order for consistent portal layout. */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order')->orderBy('created_at', 'desc');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Valid content types accepted by this module. */
    public static function validTypes(): array
    {
        return ['announcement', 'banner', 'clinic_info', 'featured_service'];
    }
}

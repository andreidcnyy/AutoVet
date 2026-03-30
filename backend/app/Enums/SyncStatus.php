<?php

namespace App\Enums;

/**
 * Sync status values for offline-first architecture.
 *
 * Records cycle through these states as they move
 * between local creation and cloud synchronization.
 */
enum SyncStatus: string
{
    /** Created or modified locally; has never been sent to cloud. */
    case LOCAL_ONLY = 'local_only';

    /** Modified since last successful sync; waiting to be uploaded. */
    case PENDING    = 'pending_sync';

    /** Successfully synchronized with the cloud server. */
    case SYNCED     = 'synced';

    /** A conflict was detected between local and cloud versions. */
    case CONFLICT   = 'conflict';

    /** Sync was attempted but failed; will retry. */
    case FAILED     = 'failed';

    /**
     * Returns true if this record needs to be sent to cloud.
     */
    public function needsSync(): bool
    {
        return in_array($this, [self::LOCAL_ONLY, self::PENDING, self::FAILED]);
    }
}

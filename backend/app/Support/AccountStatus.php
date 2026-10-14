<?php

namespace App\Support;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Clinic;
use App\Models\PortalUser;
use Illuminate\Support\Facades\Cache;

/**
 * One answer to "may this account use the system right now?", shared by the
 * password login, Google sign-in and the per-request EnsureAccountActive
 * middleware so the three cannot drift apart.
 */
class AccountStatus
{
    /**
     * Returns null when the account may proceed, otherwise
     * ['code' => string, 'message' => string] describing why not.
     */
    public static function blockReason($user): ?array
    {
        if ($user instanceof PortalUser) {
            if ($user->status === 'suspended') {
                return [
                    'code'    => 'ACCOUNT_SUSPENDED',
                    'message' => 'Your account has been temporarily suspended. Please contact the clinic.',
                ];
            }
            if ($user->status === 'deactivated') {
                return [
                    'code'    => 'ACCOUNT_DEACTIVATED',
                    'message' => 'Your account has been deactivated. Please contact the clinic to restore access.',
                ];
            }
        }

        if ($user instanceof Admin && strtolower((string) $user->status) === 'inactive') {
            return [
                'code'    => 'ACCOUNT_DEACTIVATED',
                'message' => 'This account has been deactivated. Please contact your clinic administrator.',
            ];
        }

        // A clinic switched off by the platform takes its staff and its
        // clients with it. Super admins belong to no clinic and are exempt.
        $isSuperAdmin = $user instanceof Admin && $user->role === Roles::SUPER_ADMIN->value;
        if (!$isSuperAdmin && $user->clinic_id) {
            $status = self::clinicStatus((int) $user->clinic_id);
            if ($status !== null && strtolower($status) !== 'active') {
                return [
                    'code'    => 'CLINIC_INACTIVE',
                    'message' => 'This clinic is currently inactive. Please contact the clinic for assistance.',
                ];
            }
        }

        return null;
    }

    /** Clinic status, cached briefly because the middleware asks on every request. */
    public static function clinicStatus(int $clinicId): ?string
    {
        return Cache::remember(self::clinicCacheKey($clinicId), 60, fn () =>
            Clinic::query()->whereKey($clinicId)->value('status')
        );
    }

    public static function forgetClinic(int $clinicId): void
    {
        Cache::forget(self::clinicCacheKey($clinicId));
    }

    private static function clinicCacheKey(int $clinicId): string
    {
        return "clinic_status_{$clinicId}";
    }
}

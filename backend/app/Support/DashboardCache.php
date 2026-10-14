<?php

namespace App\Support;

use App\Enums\Roles;
use App\Models\Clinic;
use Illuminate\Support\Facades\Cache;

/**
 * Cache keys for clinic-wide dashboard data.
 *
 * The dashboard caches used fixed keys ("dashboard_inventory_forecast"), so
 * whichever clinic loaded a card first had its numbers served to every other
 * clinic for the next hour. Keys now carry the clinic; a super admin, who
 * sees across clinics, gets a key of its own.
 */
class DashboardCache
{
    /** Keys that hold per-clinic dashboard data and are cleared together. */
    private const CLEARABLE = [
        'dashboard_inventory_forecast',
        'dashboard_stats',
        'dashboard_inventory_consumption_6',
        'dashboard_inventory_consumption_12',
    ];

    public static function key(string $base, $user = null): string
    {
        $user ??= auth()->user();

        if (!$user) {
            return "{$base}:guest";
        }

        if (($user->role ?? null) === Roles::SUPER_ADMIN->value) {
            return "{$base}:all";
        }

        return "{$base}:clinic_" . ($user->clinic_id ?? 'none');
    }

    /** Clears the clearable dashboard keys for every clinic and the platform view. */
    public static function forgetEverywhere(): void
    {
        $scopes = Clinic::query()->pluck('id')->map(fn ($id) => "clinic_{$id}")->push('all');

        foreach (self::CLEARABLE as $base) {
            Cache::forget($base); // pre-scoping key, in case one is still cached
            foreach ($scopes as $scope) {
                Cache::forget("{$base}:{$scope}");
            }
        }
    }
}

<?php

namespace App\Services;

use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * The scheduled maintenance window, in one place.
 *
 * Maintenance is not a plain on/off flag any more. Switching it on schedules a
 * window: a warning period during which the portal still works and shows a
 * countdown, then the outage itself, which lifts on its own.
 *
 * The state is derived from the clock every time it is asked for, rather than
 * flipped by a background job. There is no queue worker or cron on the free
 * tier, so anything that depended on a scheduled job to end maintenance would
 * leave the portal down indefinitely. Deriving it means the window closes on
 * time even if nothing else is running.
 *
 * All timestamps are stored and compared in UTC; the app runs in UTC and the
 * clients are handed the server clock so they never count down against their own.
 */
class MaintenanceWindow
{
    public const KEY_ENABLED = 'maintenance_mode';
    public const KEY_STARTS_AT = 'maintenance_starts_at';
    public const KEY_ENDS_AT = 'maintenance_ends_at';
    public const KEY_MESSAGE = 'maintenance_message';

    /** Settings are read on nearly every portal request, so keep them briefly. */
    private const CACHE_KEY = 'maintenance_window_settings';
    private const CACHE_SECONDS = 10;

    /**
     * @return array{
     *   enabled: bool, active: bool, upcoming: bool,
     *   starts_at: ?string, ends_at: ?string,
     *   seconds_until_start: ?int, seconds_until_end: ?int,
     *   message: ?string, server_time: string
     * }
     */
    public function state(): array
    {
        $now = CarbonImmutable::now('UTC');
        $settings = $this->settings();

        $enabled = ($settings[self::KEY_ENABLED] ?? null) === 'true';
        $startsAt = $this->parse($settings[self::KEY_STARTS_AT] ?? null);
        $endsAt = $this->parse($settings[self::KEY_ENDS_AT] ?? null);

        // No start time means the switch was thrown with no schedule, which is
        // the old behaviour: in effect immediately.
        $started = $enabled && ($startsAt === null || $now->greaterThanOrEqualTo($startsAt));

        // A window with an end that has passed is over, whatever the flag says.
        $expired = $enabled && $endsAt !== null && $now->greaterThanOrEqualTo($endsAt);

        $active = $started && !$expired;
        $upcoming = $enabled && !$started && !$expired;

        return [
            'enabled' => $enabled && !$expired,
            'active' => $active,
            'upcoming' => $upcoming,
            'starts_at' => $startsAt?->toIso8601String(),
            'ends_at' => $endsAt?->toIso8601String(),
            // Carbon returns a float here, so round up rather than truncate: a
            // countdown with 0.4s left should read 1, not 0, or the client shows
            // zero while the window is still open.
            'seconds_until_start' => $upcoming ? $this->secondsBetween($now, $startsAt) : null,
            'seconds_until_end' => $active && $endsAt ? $this->secondsBetween($now, $endsAt) : null,
            'message' => $settings[self::KEY_MESSAGE] ?? null,
            'server_time' => $now->toIso8601String(),
        ];
    }

    /** True only while the portal should actually be blocked. */
    public function isBlocking(): bool
    {
        return $this->state()['active'];
    }

    /**
     * Schedules a window. $startsInSeconds of warning, then $lastsSeconds of
     * outage; a null duration means it stays on until switched off by hand.
     */
    public function schedule(int $startsInSeconds, ?int $lastsSeconds, ?string $message = null): array
    {
        $now = CarbonImmutable::now('UTC');
        $startsAt = $now->addSeconds(max(0, $startsInSeconds));

        $this->put(self::KEY_ENABLED, 'true');
        $this->put(self::KEY_STARTS_AT, $startsAt->toIso8601String());
        $this->put(
            self::KEY_ENDS_AT,
            $lastsSeconds !== null && $lastsSeconds > 0
                ? $startsAt->addSeconds($lastsSeconds)->toIso8601String()
                : null
        );
        $this->put(self::KEY_MESSAGE, $message);

        $this->forget();

        return $this->state();
    }

    /** Switches maintenance off and clears the schedule. */
    public function cancel(): array
    {
        $this->put(self::KEY_ENABLED, 'false');
        $this->put(self::KEY_STARTS_AT, null);
        $this->put(self::KEY_ENDS_AT, null);
        $this->put(self::KEY_MESSAGE, null);

        $this->forget();

        return $this->state();
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** @return array<string,?string> */
    private function settings(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_SECONDS, function () {
            return Setting::withoutGlobalScopes()
                ->whereIn('key', [
                    self::KEY_ENABLED,
                    self::KEY_STARTS_AT,
                    self::KEY_ENDS_AT,
                    self::KEY_MESSAGE,
                ])
                ->pluck('value', 'key')
                ->all();
        });
    }

    private function put(string $key, ?string $value): void
    {
        // withoutGlobalScopes so this behaves the same for an unauthenticated
        // request as it does for a signed-in admin; there is one clinic's worth
        // of settings and the flag is system-wide.
        $existing = Setting::withoutGlobalScopes()->where('key', $key)->first();

        if ($existing) {
            $existing->update(['value' => $value]);

            return;
        }

        Setting::withoutGlobalScopes()->create([
            'key' => $key,
            'value' => $value,
            'clinic_id' => Setting::withoutGlobalScopes()->value('clinic_id') ?? 1,
        ]);
    }

    private function secondsBetween(CarbonImmutable $from, ?CarbonImmutable $to): int
    {
        if ($to === null) {
            return 0;
        }

        return max(0, (int) ceil($to->getTimestamp() - $from->getTimestamp()));
    }

    private function parse(?string $value): ?CarbonImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (\Throwable) {
            // A malformed timestamp must not take the portal down, so treat it
            // as "no schedule" rather than letting the exception escape.
            return null;
        }
    }
}

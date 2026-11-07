<?php

namespace App\Support;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\PortalUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The one place audit rows are written.
 *
 * Each row records who did it (a snapshot of their name and role, so the
 * entry still reads correctly after the account is renamed or removed), what
 * record it was about (a readable label alongside the id), which request it
 * came from (rows sharing a request_id were one action) and the visitor's
 * real address rather than the proxy's.
 *
 * Secrets never reach the table: password hashes, tokens and similar fields
 * are replaced with a marker, so "password changed" is still visible but the
 * value is not.
 */
class AuditLogger
{
    public const REDACTED = '[hidden]';

    /** Not worth an audit row on their own: bookkeeping columns. */
    private const NOISE = ['updated_at', 'created_at', 'last_synced_at', 'sync_version', 'last_login_at', 'last_seen_at'];

    /** Longest text kept per field; notes and descriptions are cut here. */
    private const MAX_VALUE_LENGTH = 500;

    private static ?string $requestId = null;

    private static ?Model $actingAs = null;

    /**
     * Credits rows written inside $callback to $actor. For signed-out flows
     * (password reset) where the person is known but not signed in.
     */
    public static function as(Model $actor, callable $callback): mixed
    {
        $previous = self::$actingAs;
        self::$actingAs = $actor;

        try {
            return $callback();
        } finally {
            self::$actingAs = $previous;
        }
    }

    /**
     * A wrong password on a real account. At most one row per account every
     * ten minutes, so a password-guessing run cannot fill the table.
     */
    public static function failedLogin(Model $account): void
    {
        if (Cache::add('audit-login-failed:'.get_class($account).':'.$account->getKey(), 1, now()->addMinutes(10))) {
            self::record('login_failed', $account);
        }
    }

    /**
     * Writes a row. $subject is the record acted on; $actor defaults to the
     * signed-in user and can be passed explicitly where nobody is signed in
     * yet (logins, password resets).
     */
    public static function record(
        string $action,
        Model $subject,
        ?array $old = null,
        ?array $new = null,
        ?Model $actor = null,
    ): void {
        try {
            $actor ??= self::$actingAs ?? Auth::user();

            $clinicId = $subject->getAttribute('clinic_id') ?? $actor?->getAttribute('clinic_id');
            if ($clinicId === null) {
                // audit_logs.clinic_id is required, and a row nobody's clinic
                // can see would be no use to anyone.
                return;
            }

            $request = request();

            $actorName = $actor ? (string) ($actor->getAttribute('name') ?: $actor->getAttribute('email')) : null;
            $actorType = self::actorType($actor);

            // A super admin acting through an impersonation token shows up as
            // the clinic admin; say so, or their actions read as the admin's.
            if ($actor instanceof Admin && self::tokenName($actor) === 'impersonation-token') {
                $actorType = 'impersonation';
                $actorName .= ' (via super admin)';
            }

            AuditLog::withoutGlobalScopes()->create([
                'clinic_id' => $clinicId,
                'user_id' => $actor instanceof Admin ? $actor->getKey() : null,
                'actor_type' => $actorType,
                'actor_name' => $actorName === null ? null : Str::limit($actorName, 250, ''),
                'actor_role' => $actor instanceof Admin ? $actor->getAttribute('role') : ($actor instanceof PortalUser ? 'owner' : null),
                'action' => $action,
                'model_type' => get_class($subject),
                'model_id' => $subject->getKey(),
                'label' => self::label($subject, $old, $new),
                'old_values' => $old === null ? null : self::redact($old),
                'new_values' => $new === null ? null : self::redact($new),
                'request_id' => self::requestId(),
                'ip_address' => $request ? ClientIp::of($request) : null,
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 250, '') : null,
            ]);

            self::maybePrune();
        } catch (\Throwable $e) {
            // Never let the audit trail break the action being audited.
            Log::error('Failed to write audit log: '.$e->getMessage());
        }
    }

    /**
     * Old and new values of only the fields that changed, without
     * bookkeeping columns. Null when nothing worth recording changed.
     *
     * @return array{0: array, 1: array}|null
     */
    public static function diff(Model $model): ?array
    {
        $changes = array_diff_key($model->getChanges(), array_flip(self::NOISE));
        // Restoring saves deleted_at = null; the 'restored' row covers it.
        if ($changes === [] || array_keys($changes) === ['deleted_at']) {
            return null;
        }

        $original = $model->getOriginal();
        $old = [];
        foreach (array_keys($changes) as $key) {
            $old[$key] = $original[$key] ?? null;
        }

        // Keep the record's name with the change so the entry says which
        // record it was even when the name itself did not change.
        foreach (['name', 'title', 'invoice_number', 'item_name', 'key'] as $labelKey) {
            if (! array_key_exists($labelKey, $changes) && $model->getAttribute($labelKey) !== null) {
                $old[$labelKey] = $changes[$labelKey] = $model->getAttribute($labelKey);
                break;
            }
        }

        return [$old, $changes];
    }

    public static function isSensitive(string $key): bool
    {
        $key = strtolower($key);

        return in_array($key, ['password', 'remember_token', 'google_id', 'two_factor_secret', 'two_factor_recovery_codes', 'secret', 'api_key'], true)
            || str_ends_with($key, '_token')
            || str_ends_with($key, '_secret')
            || str_ends_with($key, '_key') && $key !== 'key'
            || str_contains($key, 'password');
    }

    /**
     * Hides secrets and keeps each row small: long text is cut short and
     * nested data (JSON columns, blobs) is replaced by a marker, so one busy
     * table cannot fill the database through its audit trail.
     */
    public static function redact(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        foreach ($values as $key => $value) {
            if (is_string($key) && self::isSensitive($key)) {
                $values[$key] = $value === null || $value === '' ? null : self::REDACTED;
            } elseif (is_array($value) || is_object($value)) {
                $values[$key] = '[data]';
            } elseif (is_string($value) && mb_strlen($value) > self::MAX_VALUE_LENGTH) {
                $values[$key] = mb_substr($value, 0, self::MAX_VALUE_LENGTH).'…';
            }
        }

        return $values;
    }

    /**
     * Deletes rows older than the retention period (AUDIT_RETENTION_DAYS,
     * default 365; 0 keeps everything). Production runs no scheduler, so
     * about one write in 200 clears up to 500 expired rows. Small enough not
     * to slow that request; frequent enough to keep up with the table.
     */
    public static function prune(int $limit = 500): int
    {
        $days = (int) config('services.audit.retention_days', 365);
        if ($days <= 0) {
            return 0;
        }

        $ids = AuditLog::withoutGlobalScopes()
            ->where('created_at', '<', now()->subDays($days))
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id');

        return $ids->isEmpty() ? 0 : AuditLog::withoutGlobalScopes()->whereIn('id', $ids)->delete();
    }

    private static function maybePrune(): void
    {
        if (random_int(1, 200) !== 1) {
            return;
        }

        try {
            self::prune();
        } catch (\Throwable $e) {
            Log::warning('Audit log prune failed: '.$e->getMessage());
        }
    }

    /** One id per HTTP request (or console run), shared by every row it writes. */
    public static function requestId(): string
    {
        return self::$requestId ??= (string) Str::uuid();
    }

    /** Called between requests by long-running workers and in tests. */
    public static function resetRequestId(): void
    {
        self::$requestId = null;
    }

    private static function tokenName(Admin $actor): ?string
    {
        try {
            $token = $actor->currentAccessToken();

            return $token instanceof PersonalAccessToken && is_string($name = $token->getAttribute('name')) ? $name : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private static function actorType(?Model $actor): string
    {
        return match (true) {
            $actor instanceof Admin => 'staff',
            $actor instanceof PortalUser => 'client',
            default => app()->runningInConsole() ? 'system' : 'guest',
        };
    }

    private static function label(Model $subject, ?array $old, ?array $new): ?string
    {
        $values = ($new ?? []) + ($old ?? []) + $subject->getAttributes();

        foreach (['name', 'title', 'invoice_number', 'item_name', 'subject', 'email', 'key'] as $field) {
            if (! empty($values[$field]) && is_scalar($values[$field])) {
                return Str::limit((string) $values[$field], 250, '');
            }
        }

        // Records named by what they belong to, e.g. an appointment.
        foreach (['pet', 'owner'] as $relation) {
            if (method_exists($subject, $relation)) {
                try {
                    $related = $subject->{$relation}()->withoutGlobalScopes()->first();
                    if ($related?->getAttribute('name')) {
                        return Str::limit(ucfirst($relation).': '.$related->getAttribute('name'), 250, '');
                    }
                } catch (\Throwable) {
                    // A label is a nicety; fall through to none.
                }
            }
        }

        return null;
    }
}

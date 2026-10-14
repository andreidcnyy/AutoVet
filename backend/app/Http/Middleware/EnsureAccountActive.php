<?php

namespace App\Http\Middleware;

use App\Support\AccountStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Re-checks on every request what login checks once.
 *
 * Without it, suspending a client, deactivating a staff account or switching
 * a clinic off only took effect at the next sign-in: a session already open
 * kept working for up to 30 days.
 *
 * It also confines a recovery token (issued to an account inside its
 * self-deletion grace period) to the few routes that recovery needs.
 */
class EnsureAccountActive
{
    /** Routes a recovery-only token may reach. */
    private const RECOVERY_ROUTES = [
        'api/profile/recover',
        'api/logout',
        'api/profile',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $token = method_exists($user, 'currentAccessToken') ? $user->currentAccessToken() : null;
        $isRecoveryToken = $token && method_exists($token, 'can') && !$token->can('*') && $token->can('recover');

        if ($isRecoveryToken && !$request->is(...self::RECOVERY_ROUTES)) {
            return response()->json([
                'message' => 'This account is scheduled for deletion. Recover it to continue.',
                'code'    => 'ACCOUNT_PENDING_DELETION',
            ], 403);
        }

        if ($block = AccountStatus::blockReason($user)) {
            return response()->json([
                'message' => $block['message'],
                'code'    => $block['code'],
            ], 403);
        }

        return $next($request);
    }
}

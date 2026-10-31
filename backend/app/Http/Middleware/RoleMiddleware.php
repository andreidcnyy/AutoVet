<?php

namespace App\Http\Middleware;

use App\Enums\Roles;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Determine user role
        $userRole = null;
        if (isset($user->role)) {
            $userRole = $user->role;
        } elseif (method_exists($user, 'isOwner') && $user->isOwner()) {
            $userRole = Roles::OWNER->value;
        }

        if (! $userRole) {
            // Identify the account only: the attribute dump this replaced
            // wrote the password hash into the log.
            Log::warning('RoleMiddleware: Role not defined for user '.$user->id, [
                'class' => get_class($user),
            ]);

            return response()->json(['message' => 'Unauthorized. Role not defined.'], 403);
        }

        $userRole = strtolower($userRole);

        // Super Admin bypasses all role checks
        if ($userRole === Roles::SUPER_ADMIN->value) {
            return $next($request);
        }

        $lowercasedRoles = array_map('strtolower', $roles);

        if (! in_array($userRole, $lowercasedRoles)) {
            return response()->json([
                'message' => 'Unauthorized. This action is restricted to '.implode(' or ', $roles).'.',
            ], 403);
        }

        return $next($request);
    }
}

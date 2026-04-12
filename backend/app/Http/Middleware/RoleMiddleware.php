<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Enums\Roles;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Determine user role
        $userRole = null;
        if ($user instanceof \App\Models\Admin) {
            $userRole = $user->role;
        } elseif ($user instanceof \App\Models\PortalUser || (method_exists($user, 'isOwner') && $user->isOwner())) {
            $userRole = Roles::OWNER->value;
        }

        if (!$userRole) {
            return response()->json(['message' => 'Unauthorized. Role not defined.'], 403);
        }

        $userRole = strtolower($userRole);
        $lowercasedRoles = array_map('strtolower', $roles);

        if (!in_array($userRole, $lowercasedRoles)) {
            return response()->json([
                'message' => 'Unauthorized. This action is restricted to ' . implode(' or ', $roles) . '.',
            ], 403);
        }

        return $next($request);
    }
}

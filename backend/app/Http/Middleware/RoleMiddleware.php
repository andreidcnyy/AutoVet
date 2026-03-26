<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $roles
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!$request->user()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $userRole = strtolower($request->user()->role);
        $lowercasedRoles = array_map('strtolower', $roles);

        if (!in_array($userRole, $lowercasedRoles)) {
            return response()->json([
                'message' => 'Unauthorized. This action is restricted to ' . implode(' or ', $roles) . '.',
            ], 403);
        }

        return $next($request);
    }
}

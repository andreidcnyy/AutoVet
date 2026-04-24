<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        if (!auth()->check()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = auth()->user();

        // Check if user has one of the required roles
        if (method_exists($user, 'hasRole') && $user->hasRole(...$roles)) {
            return $next($request);
        }

        return response()->json(['message' => 'Forbidden. Insufficient permissions.'], 403);
    }
}

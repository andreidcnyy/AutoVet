<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $csp = "default-src 'self'; "
            ."script-src 'self' 'unsafe-inline'; "
            ."style-src 'self' 'unsafe-inline'; "
            ."connect-src 'self' https://autovet.onrender.com https://autovet-admin.vercel.app https://autovet-portal.vercel.app ws: wss:; "
            ."img-src 'self' https: data: blob:; "
            ."font-src 'self' data:; "
            ."frame-ancestors 'none';";

        // Even in production, we should allow Vercel domains to connect
        if (app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('Content-Security-Policy', $csp);

        // Don't advertise the stack. X-XSS-Protection is gone too: browsers
        // ignore it and older ones could be tricked by it.
        $response->headers->remove('X-Powered-By');
        if (function_exists('header_remove')) {
            header_remove('X-Powered-By');
        }

        return $response;
    }
}

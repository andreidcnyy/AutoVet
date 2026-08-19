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
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $csp = "default-src 'self'; "
            . "script-src 'self' 'unsafe-inline'; "
            . "style-src 'self' 'unsafe-inline'; "
            . "connect-src 'self' https://autovet.onrender.com https://autovet-admin.vercel.app https://autovet-portal.vercel.app ws: wss:; "
            . "img-src 'self' https: data: blob:; "
            . "font-src 'self' data:; "
            . "frame-ancestors 'none';";
        
        // Even in production, we should allow Vercel domains to connect
        if (app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Content-Security-Policy', $csp);

        return $response;
    }
}

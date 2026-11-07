<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The visitor's address, for rate-limit keys only.
 *
 * Requests reach Render through the Vercel rewrite, so $request->ip() is a
 * proxy address shared by every visitor and a per-IP limit becomes one limit
 * for everybody. Vercel overwrites X-Forwarded-For with the visitor's own
 * address (it does not pass on a value the client sent), and Render appends
 * after it, so the first entry is the visitor.
 *
 * Someone calling autovet.onrender.com directly can put anything in that
 * first entry. That only lets them rotate their own rate-limit key; it is not
 * trusted for anything else (no trustProxies, so URLs, scheme and logged IPs
 * are unaffected), and registration also needs a Turnstile pass.
 */
class ClientIp
{
    public static function of(Request $request): string
    {
        $forwarded = (string) $request->headers->get('X-Forwarded-For', '');
        $first = trim(explode(',', $forwarded)[0]);

        if ($first !== '' && filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }

        return (string) $request->ip();
    }
}

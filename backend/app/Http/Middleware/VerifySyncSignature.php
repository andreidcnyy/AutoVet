<?php

namespace App\Http\Middleware;

use App\Support\Sync\SyncSignature;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the cloud's sync endpoints.
 *
 * Off unless this server is configured to accept sync (SYNC_ACCEPT=true and a
 * SYNC_SECRET): until then the endpoints answer 404, as if they did not exist.
 */
class VerifySyncSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('services.sync.secret');

        if (! config('services.sync.accept') || $secret === '') {
            abort(404);
        }

        $timestamp = (int) $request->header(SyncSignature::HEADER_TIMESTAMP);
        $signature = (string) $request->header(SyncSignature::HEADER_SIGNATURE);

        if ($timestamp === 0 || abs(time() - $timestamp) > SyncSignature::MAX_SKEW) {
            return response()->json(['message' => 'Sync request expired or missing its timestamp. Check the computer clock.'], 401);
        }

        $content = $request->isMethod('GET')
            ? SyncSignature::canonicalQuery($request->query())
            : $request->getContent();

        $expected = SyncSignature::sign($secret, $timestamp, $request->method(), $request->getPathInfo(), $content);

        if ($signature === '' || ! hash_equals($expected, $signature)) {
            return response()->json(['message' => 'Invalid sync signature.'], 401);
        }

        return $next($request);
    }
}

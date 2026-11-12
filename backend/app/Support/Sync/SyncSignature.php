<?php

namespace App\Support\Sync;

/**
 * Request signing between the clinic computer and the cloud.
 *
 * Both sides hold the same SYNC_SECRET. Every sync request carries a timestamp
 * and an HMAC-SHA256 over the method, path, timestamp and body (or query), so
 * the cloud accepts only requests from a holder of the secret, unaltered, and
 * only within a few minutes of being made.
 */
final class SyncSignature
{
    public const HEADER_SIGNATURE = 'X-AutoVet-Signature';

    public const HEADER_TIMESTAMP = 'X-AutoVet-Timestamp';

    /** How old (or how far in the future) a request may be, in seconds. */
    public const MAX_SKEW = 300;

    public static function sign(string $secret, int $timestamp, string $method, string $path, string $content): string
    {
        $base = implode("\n", [$timestamp, strtoupper($method), '/'.ltrim($path, '/'), hash('sha256', $content)]);

        return hash_hmac('sha256', $base, $secret);
    }

    /** Query parameters in a fixed order, so both sides sign the same text. */
    public static function canonicalQuery(array $query): string
    {
        ksort($query);

        return http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }
}

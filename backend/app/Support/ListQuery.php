<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Shared handling of list query parameters: page size, sorting and search.
 *
 * Before this, every index read ?per_page, ?sort_by and ?sort_direction
 * straight from the request: no upper bound on page size (?per_page=1000000
 * loaded whole tables), any column name as a sort key (an unknown one was a
 * SQL error and a 500), and search text whose % and _ acted as wildcards.
 */
class ListQuery
{
    /** Ceiling for ordinary paged screens. */
    public const MAX_PER_PAGE = 100;

    /** Ceiling for small lookup tables that screens load whole into a dropdown. */
    public const MAX_LOOKUP_PER_PAGE = 1000;

    /**
     * The requested page size, or $default. A value that is not a positive
     * integer is a 422; one above $max is brought down to $max, so a screen
     * asking for "everything" still gets a bounded page.
     */
    public static function perPage(Request $request, int $default, int $max = self::MAX_PER_PAGE): int
    {
        $request->validate([
            'per_page' => 'nullable|integer|min:1',
            'page' => 'nullable|integer|min:1',
        ]);

        return min((int) ($request->input('per_page') ?? $default), $max);
    }

    /**
     * [column, direction] from ?sort_by / ?sort_direction, limited to
     * $allowed columns. Anything else is a 422.
     */
    public static function sort(Request $request, array $allowed, string $defaultBy, string $defaultDirection = 'asc'): array
    {
        $request->validate([
            'sort_by' => ['nullable', 'string', Rule::in($allowed)],
            'sort_direction' => ['nullable', 'string', Rule::in(['asc', 'desc', 'ASC', 'DESC'])],
        ]);

        return [
            $request->input('sort_by') ?: $defaultBy,
            strtolower($request->input('sort_direction') ?: $defaultDirection),
        ];
    }

    /** A LIKE pattern matching $term anywhere, with its own % and _ taken literally. */
    public static function contains(?string $term): string
    {
        return '%'.addcslashes((string) $term, '%_\\').'%';
    }
}

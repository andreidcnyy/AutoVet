<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'model_id' => 'nullable|integer',
            'per_page' => 'nullable|integer',
        ]);

        try {
            $user = auth()->user();
            if (! $user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            // Use withoutGlobalScopes to manually control the query
            $query = AuditLog::withoutGlobalScopes();

            // Apply clinic restriction manually if not super_admin
            if ($user->role !== Roles::SUPER_ADMIN->value) {
                if (! $user->clinic_id) {
                    return response()->json(['data' => [], 'total' => 0], 200);
                }
                $query->where('clinic_id', $user->clinic_id);
            }

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->input('user_id'));
            }

            // Who acted. A clinic account's role (clinic_admin, veterinarian,
            // staff, super_admin) is matched on the role saved with the entry:
            // actor_type 'staff' covers every clinic account, so filtering on
            // it filed clinic admins under "Staff". The rest are kinds of
            // actor: client, guest (sign-in attempts), system, impersonation.
            if ($request->filled('actor_type')) {
                $who = (string) $request->input('actor_type');
                if (in_array($who, Roles::all(), true) && $who !== Roles::OWNER->value) {
                    $query->where('actor_type', 'staff')->where('actor_role', $who);
                } else {
                    $query->where('actor_type', $who);
                }
            }

            if ($request->filled('user_name')) {
                $query->where('actor_name', 'like', '%'.self::escapeLike($request->input('user_name')).'%');
            }

            if ($request->filled('action_type')) {
                $query->where('action', $request->input('action_type'));
            }

            // "Pet" or "Invoice" as typed in the filter box. This compared
            // against the full class name (App\Models\Pet), so it never matched.
            if ($request->filled('model_type')) {
                $type = trim((string) $request->input('model_type'));
                $query->where(fn ($q) => $q->where('model_type', $type)
                    ->orWhere('model_type', 'like', '%\\\\'.self::escapeLike(str_replace(' ', '', $type))));
            }

            if ($request->filled('model_id')) {
                $query->where('model_id', (int) $request->input('model_id'));
            }

            // Free text: the record's name or the person's name.
            if ($request->filled('search')) {
                $term = '%'.self::escapeLike(trim((string) $request->input('search'))).'%';
                $query->where(fn ($q) => $q->where('label', 'like', $term)->orWhere('actor_name', 'like', $term));
            }

            // Everything done in one action (one request).
            if ($request->filled('request_id')) {
                $query->where('request_id', $request->input('request_id'));
            }

            if ($request->filled('date_from')) {
                $query->where('created_at', '>=', Carbon::parse($request->input('date_from'))->startOfDay());
            }

            if ($request->filled('date_to')) {
                $query->where('created_at', '<=', Carbon::parse($request->input('date_to'))->endOfDay());
            }

            // The browser's user agent is left out: it is long and the page
            // never shows it. Rows only ever hold redacted values.
            $result = $query->select([
                'id', 'clinic_id', 'user_id', 'actor_type', 'actor_name', 'actor_role',
                'action', 'model_type', 'model_id', 'label', 'old_values', 'new_values',
                'request_id', 'ip_address', 'created_at',
            ])->with(['user' => function ($q) {
                $q->withoutGlobalScopes()->select('id', 'name', 'role');
            }])->orderBy('created_at', 'desc')->orderBy('id', 'desc')->paginate(min(max((int) $request->input('per_page', 20), 10), 50));

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::error('AuditLogController@index Error: '.$e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'user' => auth()->id(),
                'request_keys' => array_keys($request->all()),
            ]);

            return response()->json(['message' => 'The audit log could not be loaded.'], 500);
        }
    }

    private static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}

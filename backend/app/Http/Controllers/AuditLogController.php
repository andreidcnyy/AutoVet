<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use App\Enums\Roles;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            // Increase sort_buffer_size for this session to handle sorting of large data rows
            \Illuminate\Support\Facades\DB::statement('SET SESSION sort_buffer_size = 1024 * 1024 * 2;'); // 2MB

            // Use withoutGlobalScopes to manually control the query
            $query = AuditLog::withoutGlobalScopes();

            // Apply clinic restriction manually if not super_admin
            if ($user->role !== Roles::SUPER_ADMIN->value) {
                if (!$user->clinic_id) {
                    return response()->json(['data' => [], 'total' => 0], 200);
                }
                $query->where('clinic_id', $user->clinic_id);
            }

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->input('user_id'));
            }

            if ($request->filled('action_type')) {
                $query->where('action', $request->input('action_type'));
            }

            if ($request->filled('model_type')) {
                $query->where('model_type', $request->input('model_type'));
            }

            if ($request->filled('date_from')) {
                $query->whereDate('created_at', '>=', $request->input('date_from'));
            }

            if ($request->filled('date_to')) {
                $query->whereDate('created_at', '<=', $request->input('date_to'));
            }

            // Load user relation without scopes
            $result = $query->with(['user' => function($q) {
                $q->withoutGlobalScopes();
            }])->orderBy('created_at', 'desc')->paginate(20);

            // Filter out super_admin logs manually for extra safety
            $items = $result->getCollection()->filter(function($log) {
                return !$log->user || $log->user->role !== Roles::SUPER_ADMIN->value;
            });
            $result->setCollection($items->values());

            return response()->json($result);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("AuditLogController@index Error: " . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'user' => auth()->id(),
                'request_keys' => array_keys($request->all())
            ]);
            return response()->json(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        try {
            // Start query without with('user') to see if that's the issue
            $query = AuditLog::query();

            if ($request->filled('user_id')) {
                $query->where('user_id', $request->input('user_id'));
            }

            if ($request->filled('action_type')) {
                $query->where('action', $request->input('action_type'));
            }

            if ($request->filled('model_type')) {
                $query->where('model_type', 'like', '%' . $request->input('model_type') . '%');
            }

            if ($request->filled('date_from')) {
                $query->whereDate('created_at', '>=', $request->input('date_from'));
            }

            if ($request->filled('date_to')) {
                $query->whereDate('created_at', '<=', $request->input('date_to'));
            }

            // Get results and then load users, filtering out super_admins manually if needed
            // Or just load them normally.
            $result = $query->with(['user' => function($q) {
                // We use withoutGlobalScopes if we suspect ClinicScope is interfering with user loading
                $q->withoutGlobalScopes();
            }])->orderBy('created_at', 'desc')->paginate(20);

            // Filter out super_admins from the current page items
            // Note: This might cause the page to have fewer than 20 items.
            // But for debugging, it's safer.
            $items = $result->getCollection()->filter(function($log) {
                return !$log->user || $log->user->role !== \App\Enums\Roles::SUPER_ADMIN->value;
            });
            $result->setCollection($items->values());

            return response()->json($result);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("AuditLogController@index Error: " . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'user' => auth()->id(),
                'request' => $request->all()
            ]);
            return response()->json(['error' => 'Internal Server Error', 'message' => $e->getMessage()], 500);
        }
    }
}

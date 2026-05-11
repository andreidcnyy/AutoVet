<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = AuditLog::with('user');

            // Exclude logs where the user is a super_admin
            $query->whereHas('user', function($q) {
                $q->where('role', '!=', \App\Enums\Roles::SUPER_ADMIN->value);
            });

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

            $result = $query->orderBy('created_at', 'desc')->paginate(20);
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

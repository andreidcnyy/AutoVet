<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user');

        if ($request->has('user_id') && $request->user_id !== '') {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->has('action_type') && $request->action_type !== '') {
            $query->where('action', $request->input('action_type'));
        }

        if ($request->has('model_type') && $request->model_type !== '') {
            $query->where('model_type', 'like', '%' . $request->input('model_type') . '%');
        }

        if ($request->has('date_from') && $request->date_from !== '') {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->has('date_to') && $request->date_to !== '') {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        return response()->json($query->orderBy('created_at', 'desc')->paginate(20));
    }
}

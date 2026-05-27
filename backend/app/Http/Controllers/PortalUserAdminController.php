<?php

namespace App\Http\Controllers;

use App\Models\PortalUser;
use Illuminate\Http\Request;

class PortalUserAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = PortalUser::withTrashed()
            ->with('owner:id,name,user_id')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            if ($request->status === 'deleted') {
                $query->whereNotNull('deleted_at');
            } else {
                $query->whereNull('deleted_at')->where('status', $request->status);
            }
        }

        return response()->json($query->paginate(20));
    }

    public function suspend(PortalUser $portalUser)
    {
        $portalUser->update(['status' => 'suspended']);
        // Revoke all tokens so the user is immediately logged out
        $portalUser->tokens()->delete();
        return response()->json(['message' => "Account for {$portalUser->name} has been suspended.", 'status' => 'suspended']);
    }

    public function deactivate(PortalUser $portalUser)
    {
        $portalUser->update(['status' => 'deactivated']);
        $portalUser->tokens()->delete();
        return response()->json(['message' => "Account for {$portalUser->name} has been deactivated.", 'status' => 'deactivated']);
    }

    public function reactivate(PortalUser $portalUser)
    {
        $portalUser->update(['status' => 'active']);
        return response()->json(['message' => "Account for {$portalUser->name} has been reactivated.", 'status' => 'active']);
    }
}

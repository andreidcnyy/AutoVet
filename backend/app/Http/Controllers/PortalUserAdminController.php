<?php

namespace App\Http\Controllers;

use App\Events\PortalUserStatusChanged;
use App\Models\AuditLog;
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
        $oldStatus = $portalUser->status;
        PortalUser::withoutEvents(fn() => $portalUser->update(['status' => 'suspended']));
        $portalUser->tokens()->delete();
        $this->auditPortalAction($portalUser, 'suspended', $oldStatus, 'suspended');
        $msg = 'Your account has been temporarily suspended. Please contact the clinic.';
        broadcast(new PortalUserStatusChanged($portalUser, 'suspended', $msg))->toOthers();
        return response()->json(['message' => "Account for {$portalUser->name} has been suspended.", 'status' => 'suspended']);
    }

    public function deactivate(PortalUser $portalUser)
    {
        $oldStatus = $portalUser->status;
        PortalUser::withoutEvents(fn() => $portalUser->update(['status' => 'deactivated']));
        $portalUser->tokens()->delete();
        $this->auditPortalAction($portalUser, 'deactivated', $oldStatus, 'deactivated');
        $msg = 'Your account has been deactivated. Please contact the clinic to restore access.';
        broadcast(new PortalUserStatusChanged($portalUser, 'deactivated', $msg))->toOthers();
        return response()->json(['message' => "Account for {$portalUser->name} has been deactivated.", 'status' => 'deactivated']);
    }

    public function reactivate(PortalUser $portalUser)
    {
        $oldStatus = $portalUser->status;
        PortalUser::withoutEvents(fn() => $portalUser->update(['status' => 'active']));
        $this->auditPortalAction($portalUser, 'reactivated', $oldStatus, 'active');
        $msg = 'Your account has been restored. Please log in again to continue.';
        broadcast(new PortalUserStatusChanged($portalUser, 'active', $msg))->toOthers();
        return response()->json(['message' => "Account for {$portalUser->name} has been reactivated.", 'status' => 'active']);
    }

    private function auditPortalAction(PortalUser $portalUser, string $action, string $oldStatus, string $newStatus): void
    {
        try {
            AuditLog::create([
                'clinic_id'  => $portalUser->clinic_id,
                'user_id'    => auth()->id(),
                'action'     => $action,
                'model_type' => PortalUser::class,
                'model_id'   => $portalUser->id,
                'old_values' => ['status' => $oldStatus, 'name' => $portalUser->name, 'email' => $portalUser->email],
                'new_values' => ['status' => $newStatus, 'name' => $portalUser->name, 'email' => $portalUser->email],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Portal audit log failed: ' . $e->getMessage());
        }
    }
}

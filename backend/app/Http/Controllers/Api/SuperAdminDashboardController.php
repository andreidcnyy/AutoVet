<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Clinic;
use App\Models\Admin;
use App\Models\SystemAnnouncement;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Enums\Roles;

class SuperAdminDashboardController extends Controller
{
    /**
     * Platform Summary Stats for Super Admin
     */
    public function stats(): JsonResponse
    {
        $totalClinics = Clinic::count();
        $activeClinics = Clinic::where('status', 'active')->count();
        $inactiveClinics = Clinic::where('status', 'inactive')->count();

        return response()->json([
            'total_clinics' => $totalClinics,
            'active_clinics' => $activeClinics,
            'inactive_clinics' => $inactiveClinics,
        ]);
    }

    /**
     * List all registered clinics
     */
    public function clinics(): JsonResponse
    {
        $clinics = Clinic::orderBy('created_at', 'desc')->get();
        return response()->json($clinics);
    }

    /**
     * Toggle clinic status
     */
    public function toggleStatus(Clinic $clinic): JsonResponse
    {
        $clinic->status = $clinic->status === 'active' ? 'inactive' : 'active';
        $clinic->save();

        return response()->json([
            'message' => "Clinic status updated to {$clinic->status}",
            'clinic' => $clinic
        ]);
    }

    /**
     * Register a new clinic
     */
    public function storeClinic(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinic_name' => 'required|string|max:255',
            'owner_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:clinics,email',
            'contact_number' => 'nullable|string|max:255',
            'contact_number_2' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,svg|max:2048',
            'subscription_tier' => 'nullable|string|max:255',
            'subscription_expires_at' => 'nullable|date',
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('clinics/logos', 'public');
            $validated['logo'] = $path;
        }

        $clinic = Clinic::create([
            ...$validated,
            'status' => 'active'
        ]);

        return response()->json([
            'message' => 'Clinic registered successfully',
            'clinic' => $clinic
        ], 201);
    }

    /**
     * Update an existing clinic
     */
    public function updateClinic(Request $request, Clinic $clinic): JsonResponse
    {
        $validated = $request->validate([
            'clinic_name' => 'required|string|max:255',
            'owner_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:clinics,email,' . $clinic->id,
            'contact_number' => 'nullable|string|max:255',
            'contact_number_2' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,svg|max:2048',
            'subscription_tier' => 'nullable|string|max:255',
            'subscription_expires_at' => 'nullable|date',
        ]);

        if ($request->hasFile('logo')) {
            if ($clinic->logo) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($clinic->logo);
            }
            $path = $request->file('logo')->store('clinics/logos', 'public');
            $validated['logo'] = $path;
        }

        $clinic->update($validated);

        return response()->json([
            'message' => 'Clinic updated successfully',
            'clinic' => $clinic
        ]);
    }

    /**
     * POWER 1: Get Admins for a specific clinic (Account Recovery)
     */
    public function clinicAdmins(Clinic $clinic): JsonResponse
    {
        $admins = Admin::withoutGlobalScopes()
            ->where('clinic_id', $clinic->id)
            ->whereIn('role', [Roles::CLINIC_ADMIN->value, Roles::VETERINARIAN->value]) 
            ->orderBy('name', 'asc')
            ->paginate(5); // Show 5 per page for the modal view
            
        return response()->json($admins);
    }

    /**
     * POWER 1: Reset password for a clinic admin
     */
    public function resetClinicAdminPassword(Request $request, Clinic $clinic, Admin $admin): JsonResponse
    {
        $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($admin->clinic_id !== $clinic->id) {
            return response()->json(['message' => 'Admin does not belong to this clinic.'], 403);
        }

        $admin->update([
            'password' => Hash::make($request->password),
            'must_change_password' => true // Force them to change it on next login
        ]);

        return response()->json(['message' => 'Password reset successfully. Admin must change it on next login.']);
    }

    /**
     * POWER 5: Impersonate Clinic (Login as Ghost)
     */
    public function impersonate(Clinic $clinic): JsonResponse
    {
        // Find the first clinic admin to impersonate
        $admin = Admin::withoutGlobalScopes()
            ->where('clinic_id', $clinic->id)
            ->where('role', Roles::CLINIC_ADMIN->value)
            ->where('status', 'active')
            ->first();

        if (!$admin) {
            return response()->json(['message' => 'No active clinic admin found for this clinic to impersonate.'], 404);
        }

        $token = $admin->createToken('impersonation-token')->plainTextToken;

        return response()->json([
            'message' => 'Impersonation started',
            'token' => $token,
            'admin' => $admin
        ]);
    }

    /**
     * POWER 4: System-Wide Audit Logs with Pagination and Filtering
     */
    public function systemLogs(Request $request): JsonResponse
    {
        $query = AuditLog::withoutGlobalScopes()
            ->with(['user' => function($q) {
                $q->withoutGlobalScopes()->select('id', 'name', 'email', 'role', 'clinic_id');
            }]);

        // Filter by clinic if provided
        if ($request->has('clinic_id') && $request->clinic_id !== 'all') {
            $query->where('clinic_id', $request->clinic_id);
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($logs);
    }

    /**
     * POWER 3: Platform-Wide Announcements - Get All
     */
    public function announcements(): JsonResponse
    {
        $announcements = SystemAnnouncement::orderBy('created_at', 'desc')->get();
        return response()->json($announcements);
    }

    /**
     * POWER 3: Store System Announcement
     */
    public function storeAnnouncement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'required|string|in:info,warning,success,error',
            'active_until' => 'nullable|date',
            'is_active' => 'boolean'
        ]);

        $announcement = SystemAnnouncement::create([
            ...$validated,
            'created_by' => auth()->id()
        ]);

        return response()->json(['message' => 'Announcement broadcasted successfully', 'announcement' => $announcement], 201);
    }

    /**
     * POWER 3: Delete Announcement
     */
    public function destroyAnnouncement(SystemAnnouncement $announcement): JsonResponse
    {
        $announcement->delete();
        return response()->json(['message' => 'Announcement removed.']);
    }
}

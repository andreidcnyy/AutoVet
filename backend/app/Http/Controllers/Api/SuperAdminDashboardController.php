<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
    private function uploadClinicLogo(\Illuminate\Http\UploadedFile $file): ?string
    {
        try {
            $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
            $name = 'clinics/logos/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $contents = file_get_contents($file->getRealPath());
            if ($contents === false) {
                throw new \RuntimeException('Could not read uploaded file from temp path');
            }
            $mime = $file->getMimeType() ?: 'image/png';
            \App\Models\StoredFile::store($name, $contents, $mime);
            \Illuminate\Support\Facades\Log::info('uploadClinicLogo OK: ' . $name);
            return $name;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('uploadClinicLogo EXCEPTION: ' . $e->getMessage());
            throw $e;
        }
    }

    public function storeClinic(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinic_name' => 'required|string|max:255',
            'owner_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:clinics,email',
            'contact_number' => 'nullable|string|max:255',
            'contact_number_2' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,svg,webp,gif|max:8192',
            'subscription_tier' => 'nullable|string|max:255',
            'subscription_expires_at' => 'nullable|date',
        ]);

        if ($request->hasFile('logo')) {
            $validated['logo'] = $this->uploadClinicLogo($request->file('logo'));
        } else {
            \Illuminate\Support\Facades\Log::warning('storeClinic: no logo file in request. files=' . json_encode(array_keys($request->allFiles())));
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
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,svg,webp,gif|max:8192',
            'subscription_tier' => 'nullable|string|max:255',
            'subscription_expires_at' => 'nullable|date',
        ]);

        if ($request->hasFile('logo')) {
            $validated['logo'] = $this->uploadClinicLogo($request->file('logo'));
        } else {
            \Illuminate\Support\Facades\Log::warning('updateClinic: no logo file in request. files=' . json_encode(array_keys($request->allFiles())));
        }

        $clinic->update(array_merge($validated, [
            'logo' => $validated['logo'] ?? $clinic->logo
        ]));

        return response()->json([
            'message' => 'Clinic updated successfully',
            'clinic' => $clinic
        ]);
    }

    /**
     * Permanently delete a clinic and all its data
     */
    public function destroyClinic(Clinic $clinic): JsonResponse
    {
        // Delete clinic logo if exists
        if ($clinic->logo) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($clinic->logo);
        }

        // We use forceDelete because the model uses SoftDeletes, 
        // and the user specifically wants to "actually delete" it.
        $clinic->forceDelete();

        return response()->json([
            'message' => 'Clinic and all associated data permanently deleted.'
        ]);
    }

    /**
     * POWER 1: Get Admins/Staff for a specific clinic
     */
    public function clinicAdmins(Clinic $clinic): JsonResponse
    {
        $admins = Admin::withoutGlobalScopes()
            ->where('clinic_id', $clinic->id)
            ->whereIn('role', [Roles::CLINIC_ADMIN->value, Roles::VETERINARIAN->value, Roles::STAFF->value])
            ->orderBy('name', 'asc')
            ->paginate(5);

        return response()->json($admins);
    }

    /**
     * Create a clinic-level user (clinic_admin / veterinarian / staff) for a specific clinic
     */
    public function storeClinicUser(Request $request, Clinic $clinic): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:admins,email',
            'password' => 'required|string|min:8',
            'role'     => ['required', 'string', Rule::in([
                Roles::CLINIC_ADMIN->value,
                Roles::VETERINARIAN->value,
                Roles::STAFF->value,
            ])],
        ]);

        $admin = Admin::create([
            'name'       => $validated['name'],
            'email'      => $validated['email'],
            'password'   => Hash::make($validated['password']),
            'role'       => $validated['role'],
            'clinic_id'  => $clinic->id,
            'status'     => 'active',
        ]);

        return response()->json(['message' => 'User created successfully.', 'admin' => $admin], 201);
    }

    /**
     * List all super_admin accounts
     */
    public function superAdmins(): JsonResponse
    {
        $admins = Admin::withoutGlobalScopes()
            ->where('role', Roles::SUPER_ADMIN->value)
            ->orderBy('name', 'asc')
            ->get();

        return response()->json($admins);
    }

    /**
     * Create a new super_admin account
     */
    public function storeSuperAdmin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:admins,email',
            'password' => 'required|string|min:8',
        ]);

        $admin = Admin::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role'     => Roles::SUPER_ADMIN->value,
            'status'   => 'active',
        ]);

        return response()->json(['message' => 'Super Admin created successfully.', 'admin' => $admin], 201);
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
            'message' => 'nullable|string',
            'type' => 'nullable|string|in:info,warning,success,error',
            'active_until' => 'nullable|date',
            'is_active' => 'boolean',
            'target' => 'nullable|string|in:admin,portal,landing,all',
        ]);

        $announcement = SystemAnnouncement::create([
            ...$validated,
            'type' => $validated['type'] ?? 'info',
            'target' => $validated['target'] ?? 'admin',
            'active_until' => $validated['active_until'] ? \Carbon\Carbon::parse($validated['active_until'])->utc() : null,
            'created_by' => auth()->id()
        ]);

        return response()->json(['message' => 'Announcement broadcasted successfully', 'announcement' => $announcement], 201);
    }

    /**
     * POWER 3: Update System Announcement
     */
    public function updateAnnouncement(Request $request, SystemAnnouncement $announcement): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'type' => 'nullable|string|in:info,warning,success,error',
            'active_until' => 'nullable|date',
            'is_active' => 'boolean',
            'target' => 'nullable|string|in:admin,portal,landing,all',
        ]);

        $announcement->update([
            ...$validated,
            'type' => $validated['type'] ?? 'info',
            'target' => $validated['target'] ?? $announcement->target,
            'active_until' => $validated['active_until'] ? \Carbon\Carbon::parse($validated['active_until'])->utc() : null,
        ]);

        return response()->json(['message' => 'Announcement updated successfully', 'announcement' => $announcement]);
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

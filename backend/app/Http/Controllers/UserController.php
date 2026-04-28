<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Admin;
use App\Enums\Roles;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        $authUser = auth()->user();

        if ($authUser->role === Roles::SUPER_ADMIN->value) {
            return response()->json(Admin::all());
        }

        // clinic_admin and below cannot see super_admin accounts
        return response()->json(Admin::where('role', '!=', Roles::SUPER_ADMIN->value)->get());
    }

    public function store(Request $request)
    {
        $authUser = auth()->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admins',
            'role' => ['nullable', 'string', 'max:255', Rule::in(Roles::all())],
            'status' => 'nullable|string|max:255',
            'password' => 'required|string|min:8',
        ]);

        // Only super_admin can create super_admin accounts
        if (
            !empty($validated['role']) &&
            $validated['role'] === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden. Only Super Admins can create Super Admin accounts.'], 403);
        }

        if (empty($validated['role'])) {
            $validated['role'] = Roles::STAFF->value;
        }
        if (empty($validated['status'])) {
            $validated['status'] = 'Active';
        }
        $validated['password'] = Hash::make($validated['password']);

        $user = Admin::create($validated);
        return response()->json($user, 201);
    }

    public function show(string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);

        if (
            $user->role === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json($user);
    }

    public function update(Request $request, string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);

        // clinic_admin cannot edit super_admin accounts
        if (
            $user->role === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden. Cannot modify Super Admin accounts.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('admins')->ignore($user->id)],
            'role' => ['nullable', 'string', 'max:255', Rule::in(Roles::all())],
            'status' => 'nullable|string|max:255',
            'password' => 'nullable|string|min:8',
        ]);

        // Only super_admin can assign the super_admin role
        if (
            !empty($validated['role']) &&
            $validated['role'] === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden. Only Super Admins can assign the Super Admin role.'], 403);
        }

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        return response()->json($user);
    }

    public function destroy(string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);

        // clinic_admin cannot delete super_admin accounts
        if (
            $user->role === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden. Cannot delete Super Admin accounts.'], 403);
        }

        $user->delete();
        return response()->json(null, 204);
    }

    /**
     * Return a minimal list of veterinarians for appointment assignment.
     * Accessible to all clinic staff.
     */
    public function vets()
    {
        $vets = Admin::where('role', Roles::VETERINARIAN->value)
            ->select('id', 'name', 'role')
            ->get();

        return response()->json($vets);
    }

    public function resetPassword(Request $request, Admin $user)
    {
        $authUser = auth()->user();

        if (
            $user->role === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return response()->json(['message' => 'Forbidden. Cannot reset a Super Admin password.'], 403);
        }

        $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user->update([
            'password' => Hash::make($request->password),
            'must_change_password' => true,
        ]);

        return response()->json(['message' => 'User password has been reset successfully.']);
    }
}

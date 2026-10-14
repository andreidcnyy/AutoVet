<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Admin;
use App\Enums\Roles;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/**
 * Clinic staff accounts.
 *
 * Every write checks Roles::canManage(): an account can only grant, edit,
 * reset or remove roles it outranks (managers may work up to their own
 * rank). Before this, a veterinarian — who holds an admin role — could
 * create clinic admins, promote itself, and reset an administrator's
 * password to take the account over.
 */
class UserController extends Controller
{
    /** The fields the staff screens use. Never the whole row. */
    private function present(Admin $user): array
    {
        return [
            'id'                   => $user->id,
            'clinic_id'            => $user->clinic_id,
            'name'                 => $user->name,
            'email'                => $user->email,
            'role'                 => $user->role,
            'status'               => $user->status,
            'avatar'               => $user->avatar,
            'must_change_password' => (bool) $user->must_change_password,
            'ai_features_enabled'  => (bool) $user->ai_features_enabled,
            'created_at'           => $user->created_at,
        ];
    }

    private function forbidden(string $message)
    {
        return response()->json(['message' => $message], 403);
    }

    public function index()
    {
        $authUser = auth()->user();

        $query = Admin::query()->orderBy('name')->orderBy('id');

        // Only a super admin sees super admin accounts.
        if ($authUser->role !== Roles::SUPER_ADMIN->value) {
            $query->where('role', '!=', Roles::SUPER_ADMIN->value);
        }

        return response()->json($query->get()->map(fn ($u) => $this->present($u)));
    }

    public function store(Request $request)
    {
        $authUser = auth()->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', 'unique:admins',
                Rule::unique('portal_users', 'email')->whereNull('deleted_at')],
            'role' => ['nullable', 'string', Rule::in([
                Roles::SUPER_ADMIN->value, Roles::CLINIC_ADMIN->value, Roles::VETERINARIAN->value, Roles::STAFF->value,
            ])],
            'status' => ['nullable', 'string', Rule::in(['Active', 'Inactive', 'active', 'inactive'])],
            'password' => 'required|string|min:8',
        ]);

        $validated['role'] = $validated['role'] ?? Roles::STAFF->value;

        if (!Roles::canManage($authUser->role, $validated['role'])) {
            return $this->forbidden('You cannot create an account with this role.');
        }

        $validated['status'] = $validated['status'] ?? 'Active';
        $validated['password'] = Hash::make($validated['password']);

        $user = Admin::create($validated);
        return response()->json($this->present($user), 201);
    }

    public function show(string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);

        if (
            $user->role === Roles::SUPER_ADMIN->value &&
            $authUser->role !== Roles::SUPER_ADMIN->value
        ) {
            return $this->forbidden('Forbidden.');
        }

        return response()->json($this->present($user));
    }

    public function update(Request $request, string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);
        $isSelf = (int) $user->id === (int) $authUser->id;

        // Editing your own name or email goes through /profile; here an
        // account may only touch accounts it outranks.
        if (!$isSelf && !Roles::canManage($authUser->role, $user->role)) {
            return $this->forbidden('You cannot modify this account.');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('admins')->ignore($user->id),
                Rule::unique('portal_users', 'email')->whereNull('deleted_at')],
            'role' => ['nullable', 'string', Rule::in([
                Roles::SUPER_ADMIN->value, Roles::CLINIC_ADMIN->value, Roles::VETERINARIAN->value, Roles::STAFF->value,
            ])],
            'status' => ['nullable', 'string', Rule::in(['Active', 'Inactive', 'active', 'inactive'])],
            'password' => 'nullable|string|min:8',
        ]);

        if (!empty($validated['role']) && $validated['role'] !== $user->role) {
            if ($isSelf) {
                return $this->forbidden('You cannot change your own role.');
            }
            if (!Roles::canManage($authUser->role, $validated['role'])) {
                return $this->forbidden('You cannot assign this role.');
            }
        } else {
            unset($validated['role']);
        }

        if ($isSelf && isset($validated['status']) && strtolower($validated['status']) !== strtolower((string) $user->status)) {
            return $this->forbidden('You cannot change your own status.');
        }

        if (!empty($validated['password'])) {
            if ($isSelf) {
                return $this->forbidden('Use Change Password to change your own password.');
            }
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        // A deactivated account or a password set by someone else must not
        // leave the old sessions running.
        if (isset($validated['password']) || (isset($validated['status']) && strtolower($validated['status']) === 'inactive')) {
            $user->tokens()->delete();
        }

        return response()->json($this->present($user->fresh()));
    }

    public function destroy(string $id)
    {
        $authUser = auth()->user();
        $user = Admin::findOrFail($id);

        if ((int) $user->id === (int) $authUser->id) {
            return $this->forbidden('You cannot delete your own account.');
        }

        if (!Roles::canManage($authUser->role, $user->role)) {
            return $this->forbidden('You cannot delete this account.');
        }

        $user->tokens()->delete();
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
            ->orderBy('name')
            ->get();

        return response()->json($vets);
    }

    public function resetPassword(Request $request, Admin $user)
    {
        $authUser = auth()->user();

        if ((int) $user->id === (int) $authUser->id || !Roles::canManage($authUser->role, $user->role)) {
            return $this->forbidden('You cannot reset the password of this account.');
        }

        $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user->update([
            'password' => Hash::make($request->password),
            'must_change_password' => true,
        ]);
        $user->tokens()->delete();

        return response()->json(['message' => 'User password has been reset successfully.']);
    }
}

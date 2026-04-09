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
        return response()->json(Admin::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admins',
            'role' => ['nullable', 'string', 'max:255', Rule::in(Roles::all())],
            'status' => 'nullable|string|max:255',
            'password' => 'required|string|min:8',
        ]);

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
        $user = Admin::findOrFail($id);
        return response()->json($user);
    }

    public function update(Request $request, string $id)
    {
        $user = Admin::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('admins')->ignore($user->id)],
            'role' => ['nullable', 'string', 'max:255', Rule::in(Roles::all())],
            'status' => 'nullable|string|max:255',
            'password' => 'nullable|string|min:8',
        ]);

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
        $user = Admin::findOrFail($id);
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
            ->select('id', 'name')
            ->get();

        return response()->json($vets);
    }

    public function resetPassword(Request $request, Admin $user)
    {
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

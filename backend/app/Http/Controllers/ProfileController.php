<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Events\EntityCreated;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\PortalUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function show()
    {
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }
        // Expose whether a password is set so the portal can show "Set" vs "Change"
        // password (Google sign-up accounts start with no password).
        $data = $user->toArray();
        $data['has_password'] = ! empty($user->password);

        return response()->json($data);
    }

    public function devices(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $devices = $user->tokens()
            ->select(['id', 'name', 'ip_address', 'user_agent', 'last_used_at', 'created_at'])
            ->latest()
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'ip_address' => $token->ip_address,
                'user_agent' => $token->user_agent,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
                'is_current' => $token->id === $currentTokenId,
            ]);

        return response()->json($devices);
    }

    public function revokeDevice(Request $request, $tokenId)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        if ((int) $tokenId === $currentTokenId) {
            return response()->json(['error' => 'Cannot revoke your current session.'], 422);
        }

        $deleted = $user->tokens()->where('id', $tokenId)->delete();

        if (! $deleted) {
            return response()->json(['error' => 'Session not found.'], 404);
        }

        return response()->json(['message' => 'Device session revoked.']);
    }

    public function revokeOtherDevices(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $count = $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => "Revoked {$count} other session(s)."]);
    }

    public function completeProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'phone' => 'required|string|size:11',
            'address' => 'required|string|max:500',
            'province' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'zip' => 'nullable|string|max:10',
        ]);

        $user->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Profile completed.',
            'user' => $user->fresh(),
        ]);
    }

    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        if (! ($user instanceof PortalUser)) {
            return response()->json(['error' => 'Only portal users can delete their account.'], 403);
        }

        if ($user->deletion_requested_at) {
            return response()->json(['error' => 'Account deletion is already scheduled.'], 422);
        }

        // Mark for deletion — actual soft-delete happens after 30 days
        $user->forceFill(['deletion_requested_at' => now()])->save();

        // Revoke all tokens so they can't use the app anymore
        $user->tokens()->delete();

        return response()->json(['message' => 'Your account is scheduled for deletion in 30 days.']);
    }

    public function recoverAccount(Request $request)
    {
        $user = $request->user();

        if (! ($user instanceof PortalUser)) {
            return response()->json(['error' => 'Unauthorized.'], 403);
        }

        $user->forceFill(['deletion_requested_at' => null])->save();

        // The caller holds a recovery-only token. Swap it for a full session
        // so the portal can carry on without asking them to sign in again.
        $user->currentAccessToken()?->delete();
        $token = $user->createToken('portal')->plainTextToken;

        return response()->json([
            'message' => 'Your account has been recovered successfully.',
            'token' => $token,
        ]);
    }

    public function update(Request $request)
    {
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $table = ($user instanceof Admin) ? 'admins' : 'portal_users';
        $otherTable = ($user instanceof Admin) ? 'portal_users' : 'admins';

        // An address is one identity across both account tables: login checks
        // admins first, so a portal user sharing a staff address could never
        // sign in again.
        $emailChanging = strcasecmp((string) $request->input('email'), (string) $user->email) !== 0;

        $rules = [
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255',
                Rule::unique($table, 'email')->ignore($user->id),
                Rule::unique($otherTable, 'email')->whereNull('deleted_at'),
            ],
            'avatar' => ['nullable', 'string', 'max:2800000', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+\/]+=*$/i'],
        ];

        // Role is a privilege, not a profile preference: only users who already
        // hold an administrative role may set it here. Without this check any
        // authenticated staff account could promote itself to clinic_admin by
        // posting a role to its own profile.
        $canManageRoles = $user instanceof Admin && in_array(
            $user->role,
            [Roles::SUPER_ADMIN->value, Roles::CLINIC_ADMIN->value],
            true
        );

        // Portal clients edit their contact details on the same form. These
        // were sent all along but never validated, so update() discarded them
        // and the edit looked saved while nothing changed.
        if ($user instanceof PortalUser) {
            // The portal's phone widget sends +639XXXXXXXXX; store the local
            // 09XXXXXXXXX form every other screen uses.
            if ($request->filled('phone')) {
                $digits = preg_replace('/\D/', '', (string) $request->input('phone'));
                if (str_starts_with($digits, '63') && strlen($digits) === 12) {
                    $digits = '0'.substr($digits, 2);
                }
                $request->merge(['phone' => $digits]);
            }

            $rules += [
                'phone' => 'sometimes|nullable|string|max:20',
                'address' => 'sometimes|nullable|string|max:500',
                'city' => 'sometimes|nullable|string|max:255',
                'province' => 'sometimes|nullable|string|max:255',
                'zip' => 'sometimes|nullable|string|max:10',
            ];
        }

        if ($canManageRoles) {
            $rules['role'] = 'sometimes|string|in:clinic_admin,veterinarian,staff';
        }

        // Changing the sign-in address takes the current password, so a
        // borrowed or stolen session cannot quietly move the account (and the
        // password-reset link) to an address the attacker controls.
        if ($emailChanging && ! empty($user->password)) {
            $rules['current_password'] = 'required|string';
        }

        $validated = $request->validate($rules);

        if ($emailChanging && ! empty($user->password)
            && ! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors' => ['current_password' => ['The current password is incorrect.']],
            ], 422);
        }
        unset($validated['current_password']);

        // Belt and braces: never let a role survive from an unauthorised caller,
        // even if a future rule change reintroduces it.
        if (! $canManageRoles) {
            unset($validated['role']);
        }

        $user->update($validated);

        // Sync name/email to linked Owner record so admin side reflects changes
        if ($user instanceof PortalUser) {
            $owner = Owner::where('user_id', $user->id)->first();
            if ($owner) {
                $syncData = array_filter(
                    array_intersect_key($validated, array_flip(['name', 'email', 'phone', 'address', 'city', 'province', 'zip'])),
                    fn ($v) => $v !== null && $v !== ''
                );
                if ($syncData) {
                    $owner->update($syncData);
                }
            }
            Cache::forget("portal_overview_{$user->id}");
        }

        // Broadcast so AuditLogTab and UserManagementTab refresh in real-time
        broadcast(new EntityCreated('admin_profile', $user->id))->toOthers();

        // Return the full user object for frontend sync
        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $user->fresh(),
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use App\Models\PortalUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OwnerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        if ($request->boolean('minimal')) {
            return response()->json(Owner::select('id', 'name', 'phone', 'email')->orderBy('name')->get());
        }

        $owners = Owner::with(['pets', 'user'])->orderBy('created_at', 'desc')->get();

        // Fallback: if user_id was never set but the owner's email matches a PortalUser,
        // treat the portal account as linked (covers owners seeded/created before user_id wiring).
        $missingEmails = $owners->filter(fn ($o) => !$o->user && !empty($o->email))->pluck('email')->unique();
        if ($missingEmails->isNotEmpty()) {
            $portalUsers = PortalUser::whereIn('email', $missingEmails)->get()->keyBy('email');
            $owners->each(function ($o) use ($portalUsers) {
                if (!$o->user && $o->email && isset($portalUsers[$o->email])) {
                    $o->setRelation('user', $portalUsers[$o->email]);
                }
            });
        }

        return response()->json($owners);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^\+?[0-9]{10,15}$/'
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ]);

        // Phone normalization
        $phone = $validated['phone'];
        $cleaned = preg_replace('/(?<!^)\+|[^0-9+]/', '', $phone);
        if (str_starts_with($cleaned, '09') && strlen($cleaned) === 11) {
            $validated['phone'] = '+63' . substr($cleaned, 1);
        } else {
            $validated['phone'] = $cleaned;
        }

        if (Owner::where('phone', $validated['phone'])->exists()) {
            return response()->json([
                'message' => 'An owner with this phone number already exists.',
                'errors' => ['phone' => ['This phone number is already registered.']]
            ], 422);
        }

        $owner = Owner::create($validated);
        return response()->json($owner, 201);
    }

    public function show(Owner $owner)
    {
        $owner->load(['pets.species', 'pets.breed', 'pets.invoices', 'user']);

        if (!$owner->user && !empty($owner->email)) {
            $portalUser = PortalUser::where('email', $owner->email)->first();
            if ($portalUser) {
                $owner->setRelation('user', $portalUser);
            }
        }

        return response()->json($owner);
    }

    public function update(Request $request, Owner $owner)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^\+?[0-9]{10,15}$/'
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ]);

        $owner->update($validated);
        return response()->json($owner->load('user'));
    }

    public function destroy(Owner $owner)
    {
        $owner->delete();
        return response()->json(null, 204);
    }
}

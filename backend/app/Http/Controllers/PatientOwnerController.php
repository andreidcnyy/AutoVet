<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PatientOwnerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $user = auth('admin_api')->user() ?? auth('portal_api')->user();
        \Log::info('Owners index accessed', [
            'user_id' => $user?->id,
            'user_type' => $user ? get_class($user) : 'null',
        ]);

        $query = Owner::with('pets');

        if ($user instanceof \App\Models\PortalUser) {
            $query->where('id', $user->owner?->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = auth('admin_api')->user() ?? auth('portal_api')->user();
        if ($user instanceof \App\Models\PortalUser) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

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
        return response()->json($owner->load('pets.species', 'pets.breed'));
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
        return response()->json($owner);
    }

    public function destroy(Owner $owner)
    {
        $owner->delete();
        return response()->json(null, 204);
    }
}

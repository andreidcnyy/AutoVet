<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;

class OwnerController extends Controller
{
    public function index()
    {
        return response()->json(Owner::with('pets')->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                'regex:/^09\d{9}$|^\+639\d{9}$/',
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ], [
            'phone.regex' => 'The phone number must be in the format 09XXXXXXXXX or +639XXXXXXXXX.',
            'phone.required' => 'Phone number is required.',
        ]);

        // Normalize phone number: 09XXXXXXXXX -> +639XXXXXXXXX
        if (str_starts_with($validated['phone'], '09')) {
            $validated['phone'] = '+63' . substr($validated['phone'], 1);
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
                'regex:/^09\d{9}$|^\+639\d{9}$/',
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ], [
            'phone.regex' => 'The phone number must be in the format 09XXXXXXXXX or +639XXXXXXXXX.',
            'phone.required' => 'Phone number is required.',
        ]);

        // Normalize phone number: 09XXXXXXXXX -> +639XXXXXXXXX
        if (str_starts_with($validated['phone'], '09')) {
            $validated['phone'] = '+63' . substr($validated['phone'], 1);
        }

        $owner->update($validated);
        return response()->json($owner);
    }

    public function destroy(Owner $owner)
    {
        $owner->delete();
        return response()->json(null, 204);
    }
}

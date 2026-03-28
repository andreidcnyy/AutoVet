<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OwnerController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        
        // Skip header
        $header = fgetcsv($handle);
        
        $count = 0;
        $errors = [];
        $row = 1;

        while (($data = fgetcsv($handle)) !== FALSE) {
            $row++;
            if (count($data) < 2) continue; // Skip empty rows

            // Expected format: name,phone,email,address,city,province,zip
            $ownerData = [
                'name' => $data[0] ?? null,
                'phone' => $data[1] ?? null,
                'email' => $data[2] ?? null,
                'address' => $data[3] ?? null,
                'city' => $data[4] ?? null,
                'province' => $data[5] ?? null,
                'zip' => $data[6] ?? null,
            ];

            $validator = Validator::make($ownerData, [
                'name' => 'required|string|max:255',
                'phone' => 'required|string',
            ]);

            if ($validator->fails()) {
                $errors[] = "Row {$row}: " . implode(", ", $validator->errors()->all());
                continue;
            }

            // Normalize phone number: 09XXXXXXXXX -> +639XXXXXXXXX
            if (str_starts_with($ownerData['phone'], '09')) {
                $ownerData['phone'] = '+63' . substr($ownerData['phone'], 1);
            }

            Owner::updateOrCreate(
                ['phone' => $ownerData['phone']],
                [
                    'name' => $ownerData['name'],
                    'email' => $ownerData['email'],
                    'address' => $ownerData['address'],
                    'city' => $ownerData['city'],
                    'province' => $ownerData['province'],
                    'zip' => $ownerData['zip'],
                ]
            );

            $count++;
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'count' => $count,
            'errors' => $errors
        ]);
    }

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

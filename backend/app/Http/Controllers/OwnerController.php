<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OwnerController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Owner::class, 'owner');
    }

    /**
     * Normalize phone number to +639XXXXXXXXX format or clean string.
     */
    private function normalizePhone(?string $phone): ?string
    {
        if (!$phone) return null;

        // Basic normalization: remove non-numeric except leading plus
        $cleaned = preg_replace('/(?<!^)\+|[^0-9+]/', '', $phone);
        
        // Example logic for PH numbers if they start with 09
        if (str_starts_with($cleaned, '09') && strlen($cleaned) === 11) {
            return '+63' . substr($cleaned, 1);
        }

        return $cleaned;
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        
        $header = fgetcsv($handle);
        
        $count = 0;
        $errors = [];
        $row = 1;

        while (($data = fgetcsv($handle)) !== FALSE) {
            $row++;
            if (count($data) < 2) continue;

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

            $ownerData['phone'] = $this->normalizePhone($ownerData['phone']);

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
        $user = auth()->user();
        $query = Owner::with('pets');

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            $query->where('id', $user->owner?->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

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
        ], [
            'phone.required' => 'Phone number is required.',
            'phone.regex' => 'The phone number format is invalid. Use international format (e.g. +639123456789).',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

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
        ], [
            'phone.required' => 'Phone number is required.',
            'phone.regex' => 'The phone number format is invalid.',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

        if (Owner::where('phone', $validated['phone'])->where('id', '!=', $owner->id)->exists()) {
            return response()->json([
                'message' => 'Another owner with this phone number already exists.',
                'errors' => ['phone' => ['This phone number is already registered to another owner.']]
            ], 422);
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

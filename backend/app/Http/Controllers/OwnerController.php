<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\NumberParseException;

class OwnerController extends Controller
{
    /**
     * Normalize phone number to +639XXXXXXXXX format.
     */
    private function normalizePhone(?string $phone): ?string
    {
        if (!$phone) return null;

        $phoneUtil = PhoneNumberUtil::getInstance();
        try {
            // Parse the number. If no leading +, we'll attempt to parse with PH as default for safety
            // but the frontend should provide + code.
            $numberProto = $phoneUtil->parse($phone, "PH");
            
            if ($phoneUtil->isValidNumber($numberProto)) {
                return $phoneUtil->format($numberProto, PhoneNumberFormat::E164);
            }
        } catch (NumberParseException $e) {
            // Fallback to basic cleanup if parsing fails
        }

        // Basic cleanup if library fails or number is invalid
        return preg_replace('/(?<!^)\+|[^0-9+]/', '', $phone);
    }

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

            // Normalize phone number
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
        return response()->json(Owner::with('pets')->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $phoneUtil = PhoneNumberUtil::getInstance();
                    try {
                        $numberProto = $phoneUtil->parse($value, "PH");
                        if (!$phoneUtil->isValidNumber($numberProto)) {
                            $fail('The phone number is not a valid international number.');
                        }
                    } catch (NumberParseException $e) {
                        $fail('The phone number format is invalid.');
                    }
                },
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

        // Check for duplicate after normalization
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
                function ($attribute, $value, $fail) {
                    $phoneUtil = PhoneNumberUtil::getInstance();
                    try {
                        $numberProto = $phoneUtil->parse($value, "PH");
                        if (!$phoneUtil->isValidNumber($numberProto)) {
                            $fail('The phone number is not a valid international number.');
                        }
                    } catch (NumberParseException $e) {
                        $fail('The phone number format is invalid.');
                    }
                },
            ],
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ], [
            'phone.required' => 'Phone number is required.',
        ]);

        $validated['phone'] = $this->normalizePhone($validated['phone']);

        // Check for duplicate after normalization (excluding current owner)
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

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Patient;

class PatientController extends Controller
{
    public function index()
    {
        return response()->json(Patient::orderBy('created_at', 'desc')->get());
    }

    public function show(Patient $patient)
    {
        return response()->json(
            $patient->load(['appointments' => function ($q) {
                $q->orderBy('date', 'desc');
            }, 'invoices.items'])
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'species'     => 'required|string|max:255',
            'breed'       => 'nullable|string|max:255',
            'date_of_birth' => 'nullable|date',
            'gender'      => 'nullable|string|max:50',
            'color'       => 'nullable|string|max:255',
            'weight'      => 'nullable|numeric|min:0',
            'status'      => 'nullable|string|max:50',
            'owner_name'  => 'required|string|max:255',
            'owner_phone' => 'nullable|string|regex:/^([0-9\s\-\+\(\)]*)$/|max:50',
            'owner_email' => 'nullable|email|max:255',
            'owner_address' => 'required|string|max:255',
            'owner_city'  => 'required|string|max:255',
            'owner_province' => 'required|string|max:255',
            'owner_zip'   => 'required|string|max:20',
            'allergies'   => 'nullable|string|max:255',
            'medication'  => 'nullable|string|max:255',
            'notes'       => 'nullable|string',
            'photo'       => 'nullable|string',
        ]);

        $patient = Patient::create($validated);

        return response()->json($patient, 201);
    }

    public function update(Request $request, Patient $patient)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'species'     => 'required|string|max:255',
            'breed'       => 'nullable|string|max:255',
            'date_of_birth' => 'nullable|date',
            'gender'      => 'nullable|string|max:50',
            'color'       => 'nullable|string|max:255',
            'weight'      => 'nullable|numeric|min:0',
            'status'      => 'nullable|string|max:50',
            'owner_name'  => 'required|string|max:255',
            'owner_phone' => 'nullable|string|regex:/^([0-9\s\-\+\(\)]*)$/|max:50',
            'owner_email' => 'nullable|email|max:255',
            'owner_address' => 'required|string|max:255',
            'owner_city'  => 'required|string|max:255',
            'owner_province' => 'required|string|max:255',
            'owner_zip'   => 'required|string|max:20',
            'allergies'   => 'nullable|string|max:255',
            'medication'  => 'nullable|string|max:255',
            'notes'       => 'nullable|string',
            'photo'       => 'nullable|string',
        ]);

        $patient->update($validated);

        return response()->json($patient);
    }

    public function destroy(Patient $patient)
    {
        $patient->delete();
        return response()->json(null, 204);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle); // Skip header

        $count = 0;
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) < 5) continue;

            Patient::create([
                'name' => $row[0] ?? 'Unknown',
                'species' => $row[1] ?? 'Unknown',
                'breed' => $row[2] ?? '',
                'gender' => $row[3] ?? 'Unknown',
                'date_of_birth' => $row[4] ?? null,
                'owner_name' => $row[5] ?? 'Unknown',
                'owner_phone' => $row[6] ?? '',
                'owner_email' => $row[7] ?? '',
                'owner_address' => $row[8] ?? '',
                'status' => 'Healthy',
            ]);
            $count++;
        }
        fclose($handle);

        return response()->json(['message' => 'Import successful', 'count' => $count]);
    }
}

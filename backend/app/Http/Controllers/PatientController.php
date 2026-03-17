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
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Appointment;

class AppointmentController extends Controller
{
    public function index()
    {
        return response()->json(Appointment::with('patient')->orderBy('date', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'date' => 'required|date',
            'time' => 'required|date_format:H:i',
            'tone' => 'nullable|string',
            'patient_id' => 'nullable|exists:patients,id',
        ]);

        $appointment = Appointment::create($validated);

        return response()->json($appointment->load('patient'), 201);
    }

    public function show(Appointment $appointment)
    {
        return response()->json($appointment->load('patient'));
    }

    public function update(Request $request, Appointment $appointment)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'date' => 'required|date',
            'time' => 'required|date_format:H:i',
            'tone' => 'nullable|string',
            'patient_id' => 'nullable|exists:patients,id',
        ]);

        $appointment->update($validated);

        return response()->json($appointment->load('patient'));
    }

    public function destroy(Appointment $appointment)
    {
        $appointment->delete();
        return response()->json(null, 204);
    }
}

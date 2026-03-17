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
}

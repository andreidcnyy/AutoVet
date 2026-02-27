<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Appointment;

class AppointmentController extends Controller
{
    public function index()
    {
        return response()->json(Appointment::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'date' => 'required|date',
            'time' => 'required|string',
            'tone' => 'nullable|string'
        ]);

        $appointment = Appointment::create($validated);

        return response()->json($appointment, 201);
    }
}

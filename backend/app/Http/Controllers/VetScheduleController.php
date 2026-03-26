<?php

namespace App\Http\Controllers;

use App\Models\VetSchedule;
use Illuminate\Http\Request;

class VetScheduleController extends Controller
{
    public function index(Request $request)
    {
        $query = VetSchedule::with('vet');
        
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'day_of_week' => 'required|string',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'break_start' => 'nullable|date_format:H:i',
            'break_end' => 'nullable|date_format:H:i',
            'is_available' => 'boolean',
            'max_appointments' => 'nullable|integer|min:1'
        ]);

        $schedule = VetSchedule::create($validated);
        return response()->json($schedule->load('vet'), 201);
    }

    public function show(VetSchedule $vetSchedule)
    {
        return response()->json($vetSchedule->load('vet'));
    }

    public function update(Request $request, VetSchedule $vetSchedule)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'day_of_week' => 'required|string',
            'start_time' => 'required|date_format:H:i', // can accept H:i:s as well but standard is H:i here
            'end_time' => 'required|date_format:H:i',
            'break_start' => 'nullable|date_format:H:i',
            'break_end' => 'nullable|date_format:H:i',
            'is_available' => 'boolean',
            'max_appointments' => 'nullable|integer|min:1'
        ]);

        // Clean formats if necessary depending on input
        if (strlen($validated['start_time']) > 5) $validated['start_time'] = substr($validated['start_time'], 0, 5);
        if (strlen($validated['end_time']) > 5) $validated['end_time'] = substr($validated['end_time'], 0, 5);

        $vetSchedule->update($validated);
        return response()->json($vetSchedule->load('vet'));
    }

    public function destroy(VetSchedule $vetSchedule)
    {
        $vetSchedule->delete();
        return response()->json(null, 204);
    }
}

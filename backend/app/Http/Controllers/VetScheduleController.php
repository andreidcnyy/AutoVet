<?php

namespace App\Http\Controllers;

use App\Models\VetSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'user_id' => 'required|exists:admins,id',
            'day_of_week' => 'required|string',
            'start_time' => 'required',
            'end_time' => 'required',
            'break_start' => 'nullable',
            'break_end' => 'nullable',
            'is_available' => 'boolean',
            'max_appointments' => 'nullable|integer'
        ]);

        $schedule = VetSchedule::create($validated);
        return response()->json($schedule->load('vet'), 201);
    }

    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:admins,id',
            'days' => 'required|array',
            'start_time' => 'required',
            'end_time' => 'required',
            'break_start' => 'nullable',
            'break_end' => 'nullable',
            'max_appointments' => 'nullable|integer'
        ]);

        $userId = $validated['user_id'];
        $days = $validated['days'];

        return DB::transaction(function () use ($validated, $userId, $days) {
            // Delete existing schedules for these days to overwrite
            VetSchedule::where('user_id', $userId)
                ->whereIn('day_of_week', $days)
                ->delete();

            $created = [];
            foreach ($days as $day) {
                $created[] = VetSchedule::create([
                    'user_id'      => $userId,
                    'day_of_week'  => $day,
                    'start_time'   => $validated['start_time'],
                    'end_time'     => $validated['end_time'],
                    'break_start'  => $validated['break_start'] ?? null,
                    'break_end'    => $validated['break_end'] ?? null,
                    'max_appointments' => $validated['max_appointments'] ?? null,
                    'is_available' => true,
                ]);
            }

            return response()->json($created, 201);
        });
    }

    public function show(VetSchedule $vetSchedule)
    {
        return response()->json($vetSchedule->load('vet'));
    }

    public function update(Request $request, VetSchedule $vetSchedule)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:admins,id',
            'day_of_week' => 'required|string',
            'start_time' => 'required',
            'end_time' => 'required',
            'break_start' => 'nullable',
            'break_end' => 'nullable',
            'is_available' => 'boolean',
            'max_appointments' => 'nullable|integer'
        ]);

        $vetSchedule->update($validated);
        return response()->json($vetSchedule->load('vet'));
    }

    public function destroy(VetSchedule $vetSchedule)
    {
        $vetSchedule->delete();
        return response()->json(null, 204);
    }
}

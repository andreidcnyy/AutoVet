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

    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'days' => 'required|array|min:1',
            'days.*' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'break_start' => 'nullable|date_format:H:i',
            'break_end' => 'nullable|date_format:H:i',
            'is_available' => 'boolean',
            'overwrite_existing' => 'boolean'
        ]);

        if ($validated['end_time'] <= $validated['start_time']) {
            return response()->json(['message' => 'The end time must be after the start time.'], 422);
        }

        if (!empty($validated['break_start']) && !empty($validated['break_end'])) {
            if ($validated['break_end'] <= $validated['break_start']) {
                return response()->json(['message' => 'Break end must be after break start.'], 422);
            }
            if ($validated['break_start'] < $validated['start_time'] || $validated['break_end'] > $validated['end_time']) {
                 return response()->json(['message' => 'Break must be within working hours.'], 422);
            }
        }

        $userId = $validated['user_id'];
        $days = $validated['days'];
        $overwrite = $validated['overwrite_existing'] ?? false;

        // Check for conflicts
        $conflicts = VetSchedule::where('user_id', $userId)
            ->whereIn('day_of_week', $days)
            ->get();

        if ($conflicts->isNotEmpty() && !$overwrite) {
            return response()->json([
                'message' => 'Conflict detected: Some selected days already have schedules.',
                'conflicting_days' => $conflicts->pluck('day_of_week')->unique()->values()
            ], 409);
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $userId, $days) {
            // Remove existing if any
            VetSchedule::where('user_id', $userId)
                ->whereIn('day_of_week', $days)
                ->delete();

            $results = [];
            foreach ($days as $day) {
                $results[] = VetSchedule::create([
                    'user_id'      => $userId,
                    'day_of_week'  => $day,
                    'start_time'   => $validated['start_time'],
                    'end_time'     => $validated['end_time'],
                    'break_start'  => $validated['break_start'] ?? null,
                    'break_end'    => $validated['break_end'] ?? null,
                    'is_available' => $validated['is_available'] ?? true,
                ]);
            }

            return response()->json([
                'message' => 'Schedules saved successfully for ' . count($results) . ' days.',
                'data' => $results
            ], 201);
        });
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

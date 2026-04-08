<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\VetSchedule;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    protected $clientNotificationService;

    public function __construct(
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->clientNotificationService = $clientNotificationService;
    }
    public function index()
    {
        return response()->json(Appointment::with(['pet', 'service', 'vet'])->orderBy('date', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date',
            'time' => 'required|date_format:H:i',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'status' => 'nullable|string|in:pending,completed,cancelled',
            'pet_id' => 'required|exists:pets,id',
            'service_id' => 'required|exists:services,id',
            'vet_id' => 'nullable|exists:users,id',
        ]);

        // Default title to service name if not provided
        if (empty($validated['title'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

        // Validate vet schedule if vet_id is provided
        if (!empty($validated['vet_id'])) {
            $dayOfWeek = date('l', strtotime($validated['date']));
            $schedule = VetSchedule::where('user_id', $validated['vet_id'])
                            ->where('day_of_week', $dayOfWeek)
                            ->where('is_available', true)
                            ->first();

            if (!$schedule) {
                // Fetch available days to provide a better error message
                $availableDays = VetSchedule::where('user_id', $validated['vet_id'])
                                    ->where('is_available', true)
                                    ->pluck('day_of_week')
                                    ->toArray();
                
                $vetName = \App\Models\User::find($validated['vet_id'])->name ?? 'the vet';
                $message = "{$vetName} is not available on {$dayOfWeek}s.";
                if (!empty($availableDays)) {
                    $message .= " They are usually available on: " . implode(', ', $availableDays) . ".";
                }
                
                return response()->json(['message' => $message], 422);
            }

            $time = date('H:i:s', strtotime($validated['time']));
            if ($time < $schedule->start_time || $time > $schedule->end_time) {
                 return response()->json(['message' => "Selected time is outside of vet's available hours (" . date('g:i A', strtotime($schedule->start_time)) . " - " . date('g:i A', strtotime($schedule->end_time)) . ")."], 422);
            }

            if ($schedule->break_start && $schedule->break_end) {
                if ($time >= $schedule->break_start && $time <= $schedule->break_end) {
                    return response()->json(['message' => 'Selected time falls during the vet\'s break period (' . date('g:i A', strtotime($schedule->break_start)) . " - " . date('g:i A', strtotime($schedule->break_end)) . ")."], 422);
                }
            }

            // Check for double booking for this vet
            $existingVetAppointment = Appointment::where('vet_id', $validated['vet_id'])
                                                ->where('date', $validated['date'])
                                                ->where('time', $validated['time'])
                                                ->first();
            if ($existingVetAppointment) {
                return response()->json(['message' => 'This vet already has an appointment at this time.'], 422);
            }
        }

        // Check for double booking for this pet
        $existingPetAppointment = Appointment::where('pet_id', $validated['pet_id'])
                                            ->where('date', $validated['date'])
                                            ->where('time', $validated['time'])
                                            ->first();
        if ($existingPetAppointment) {
            return response()->json(['message' => 'This pet already has an appointment at this time.'], 422);
        }

        $appointment = Appointment::create($validated);

        try {
            $appointment->load('pet.owner');
            $owner = $appointment->pet->owner;
            if ($owner) {
                $this->clientNotificationService->sendFromTemplate(
                    $owner,
                    'appointment_created',
                    'email',
                    [
                        'date' => $appointment->date,
                        'time' => $appointment->time,
                        'title' => $appointment->title
                    ],
                    'automated',
                    $appointment
                );
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to send automated appointment notification: " . $e->getMessage());
        }

        return response()->json($appointment->load(['pet', 'service', 'vet']), 201);
    }

    public function show(Appointment $appointment)
    {
        return response()->json($appointment->load(['pet', 'service', 'vet']));
    }

    public function update(Request $request, Appointment $appointment)
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'date' => 'required|date',
            'time' => 'required|date_format:H:i',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
            'status' => 'nullable|string|in:pending,completed,cancelled',
            'pet_id' => 'required|exists:pets,id',
            'service_id' => 'required|exists:services,id',
            'vet_id' => 'nullable|exists:users,id',
        ]);

        if (!empty($validated['vet_id'])) {
            $dayOfWeek = date('l', strtotime($validated['date']));
            $schedule = VetSchedule::where('user_id', $validated['vet_id'])
                            ->where('day_of_week', $dayOfWeek)
                            ->where('is_available', true)
                            ->first();

            if (!$schedule) {
                $availableDays = VetSchedule::where('user_id', $validated['vet_id'])
                                    ->where('is_available', true)
                                    ->pluck('day_of_week')
                                    ->toArray();
                
                $vetName = \App\Models\User::find($validated['vet_id'])->name ?? 'the vet';
                $message = "{$vetName} is not available on {$dayOfWeek}s.";
                if (!empty($availableDays)) {
                    $message .= " They are usually available on: " . implode(', ', $availableDays) . ".";
                }
                
                return response()->json(['message' => $message], 422);
            }

            $time = date('H:i:s', strtotime($validated['time']));
            if ($time < $schedule->start_time || $time > $schedule->end_time) {
                 return response()->json(['message' => "Selected time is outside of vet's available hours (" . date('g:i A', strtotime($schedule->start_time)) . " - " . date('g:i A', strtotime($schedule->end_time)) . ")."], 422);
            }

            if ($schedule->break_start && $schedule->break_end) {
                if ($time >= $schedule->break_start && $time <= $schedule->break_end) {
                    return response()->json(['message' => 'Selected time falls during the vet\'s break period (' . date('g:i A', strtotime($schedule->break_start)) . " - " . date('g:i A', strtotime($schedule->break_end)) . ")."], 422);
                }
            }

            // Check for double booking for this vet
            $existingVetAppointment = Appointment::where('vet_id', $validated['vet_id'])
                                                ->where('date', $validated['date'])
                                                ->where('time', $validated['time'])
                                                ->where('id', '!=', $appointment->id)
                                                ->first();
            if ($existingVetAppointment) {
                return response()->json(['message' => 'This vet already has an appointment at this time.'], 422);
            }
        }

        // Check for double booking for this pet
        $existingPetAppointment = Appointment::where('pet_id', $validated['pet_id'])
                                            ->where('date', $validated['date'])
                                            ->where('time', $validated['time'])
                                            ->where('id', '!=', $appointment->id)
                                            ->first();
        if ($existingPetAppointment) {
            return response()->json(['message' => 'This pet already has an appointment at this time.'], 422);
        }

        if (empty($validated['title'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

        $appointment->update($validated);
        return response()->json($appointment->load(['pet', 'service', 'vet']));
    }

    public function destroy(Appointment $appointment)
    {
        $appointment->delete();
        return response()->json(null, 204);
    }
}

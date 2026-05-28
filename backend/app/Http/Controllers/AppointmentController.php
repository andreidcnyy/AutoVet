<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\VetSchedule;
use App\Models\Admin;
use App\Traits\HasInternalNotifications;
use App\Traits\IdentifiesPortalOwner;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    use HasInternalNotifications, IdentifiesPortalOwner;

    protected $clientNotificationService;

    public function __construct(
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->clientNotificationService = $clientNotificationService;
    }

    public function index(Request $request)
    {
        $user = auth()->user();
        
        // Use with() for eager loading to prevent N+1 queries.
        // select() only columns needed for the list to reduce memory usage.
        $query = Appointment::select('id', 'title', 'date', 'time', 'status', 'is_walk_in', 'notes', 'decline_reason', 'pet_id', 'service_id', 'vet_id', 'created_at')
            ->with([
                'pet:id,name,owner_id',
                'pet.owner:id,name,email',
                'service:id,name',
                'services:id,name',
                'vet:id,name',
            ]);

        // Always hide AI Training Records from the list for Admins/Staff
        // but keep them in the DB for forecasting logic.
        $query->whereHas('pet.owner', function($q) {
            $q->realClients();
        });

        // Access control: Portal users only see their own appointments
        if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
            $ownerId = $this->getPortalOwnerId();
            if (!$ownerId) {
                $query->whereRaw('0 = 1');
            } else {
                $query->whereHas('pet', function ($q) use ($ownerId) {
                    $q->where('owner_id', $ownerId);
                });
            }
        }

        // Filtering by Pet
        if ($request->has('pet_id')) {
            $query->where('pet_id', $request->pet_id);
        }

        // Filtering by Veterinarian
        if ($request->filled('vet_id')) {
            $query->where('vet_id', $request->vet_id);
        }

        // Filtering by Service
        if ($request->filled('service_id')) {
            $query->where('service_id', $request->service_id);
        }

        // Filtering by Status
        if ($request->has('status') && $request->status !== 'all') {
            $status = $request->status;
            if ($status === 'upcoming') {
                $query->where('date', '>=', now()->toDateString())
                      ->whereNotIn('status', ['cancelled', 'declined', 'completed']);
            } elseif ($status === 'past') {
                $query->where('date', '<', now()->toDateString());
            } else {
                $query->whereRaw('LOWER(status) = ?', [strtolower($status)]);
            }
        }

        // Search functionality (title, pet name, owner name)
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhereHas('pet', function($pq) use ($search) {
                      $pq->where('name', 'like', "%{$search}%")
                        ->orWhereHas('owner', function($oq) use ($search) {
                            $oq->where('name', 'like', "%{$search}%");
                        });
                  });
            });
        }

        // If no specific status is requested, or if 'all' is requested,
        // we still want to hide 'Scheduled' (mock) data by default to keep the UI clean.
        // USER REQUEST: Only show APPROVED and CANCELLED (which includes Declined) by default
        if (!$request->has('status') || $request->status === 'all') {
             $query->whereIn('status', ['Pending', 'pending', 'Approved', 'approved', 'Cancelled', 'cancelled', 'Declined', 'declined', 'Declined (System)', 'Rejected', 'completed', 'no_show']);
        }

        if ($request->filled('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        // Handle specific date if provided
        if ($request->filled('date')) {
            $query->where('date', $request->date);
        }

        // Default sort by newest request first
        $query->orderBy('id', 'desc');

        $perPage = $request->get('per_page', 15);
        
        return response()->json($query->paginate($perPage));
    }

    /**
     * Get summary counts for calendar markers.
     */
    public function summary(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to' => 'required|date',
        ]);

        $query = Appointment::select('date', \DB::raw('count(*) as count'))
            ->where('date', '>=', $request->date_from)
            ->where('date', '<=', $request->date_to)
            ->whereHas('pet.owner', function($q) {
                $q->realClients();
            })
            ->groupBy('date');

        $summaryUser = auth()->user();
        if ($summaryUser && method_exists($summaryUser, 'isOwner') && $summaryUser->isOwner()) {
            $ownerId = $this->getPortalOwnerId();
            if (!$ownerId) {
                $query->whereRaw('0 = 1');
            } else {
                $query->whereHas('pet', function ($q) use ($ownerId) {
                    $q->where('owner_id', $ownerId);
                });
            }
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Appointment::class);

        $validated = $request->validate([
            'title'       => 'nullable|string|max:255',
            'date'        => 'required|date',
            'time'        => 'required|date_format:H:i',
            'category'    => 'nullable|string|max:100',
            'notes'       => 'nullable|string',
            'status'      => 'nullable|string|in:pending,approved,completed,cancelled,no_show',
            'is_walk_in'  => 'nullable|boolean',
            'pet_id'      => 'required|exists:pets,id',
            'service_id'  => 'nullable|exists:services,id',
            'service_ids' => 'nullable|array',
            'service_ids.*' => 'exists:services,id',
            'vet_id'      => 'nullable|exists:admins,id',
        ], [
            'pet_id.required' => 'A pet must be selected for the appointment.'
        ]);

        // Resolve primary service_id from service_ids array if not set directly
        if (empty($validated['service_id']) && !empty($validated['service_ids'])) {
            $validated['service_id'] = $validated['service_ids'][0];
        }
        if (empty($validated['service_id'])) {
            return response()->json(['message' => 'Please select at least one service.'], 422);
        }

        if ($ownerId = $this->getPortalOwnerId()) {
            $pet = \App\Models\Pet::find($validated['pet_id']);
            if (!$pet || $pet->owner_id != $ownerId) {
                return response()->json(['message' => 'You can only book appointments for your own pets.'], 403);
            }
        }

        // Max 2 active appointments per pet per day (declined/cancelled do not count)
        $MAX_PER_DAY = 2;
        $activeCount = Appointment::where('pet_id', $validated['pet_id'])
            ->where('date', $validated['date'])
            ->whereNotIn('status', ['declined', 'cancelled', 'Declined', 'Cancelled'])
            ->count();
        if ($activeCount >= $MAX_PER_DAY) {
            return response()->json([
                'message' => "This pet already has {$MAX_PER_DAY} appointment(s) booked for this day. Please choose a different date."
            ], 422);
        }

        $service = \App\Models\Service::find($validated['service_id']);

        // Default title to service name if not provided
        if (empty($validated['title'])) {
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

        // Always sync category from the selected service for forecast reliability
        if ($service && empty($validated['category'])) {
            $validated['category'] = $service->category;
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
                
                $vetName = Admin::find($validated['vet_id'])->name ?? 'the vet';
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

        $serviceIds = $validated['service_ids'] ?? [$validated['service_id']];
        unset($validated['service_ids']);

        // Walk-ins skip the pending queue and are immediately approved
        if (!empty($validated['is_walk_in'])) {
            $validated['status'] = 'approved';
        }

        $appointment = Appointment::create($validated);

        // Sync additional services to pivot table
        $appointment->services()->sync($serviceIds);

        $this->invalidatePortalCache($appointment->pet?->owner_id);

        // Broadcast appointment creation
        event(new \App\Events\AppointmentCreated($appointment));

        // Create internal notification for admins
        $this->createInternalNotification(
            'AppointmentPending',
            'New Appointment Request',
            "A new appointment for {$appointment->pet->name} has been requested for " . date('M d, Y', strtotime($appointment->date)) . " at " . date('g:i A', strtotime($appointment->time)) . ".",
            ['appointment_id' => $appointment->id]
        );

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

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']), 201);
    }

    public function show(Appointment $appointment)
    {
        $this->authorize('view', $appointment);
        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function update(Request $request, Appointment $appointment)
    {
        $this->authorize('update', $appointment);

        $validated = $request->validate([
            'title'         => 'nullable|string|max:255',
            'date'          => 'sometimes|required|date',
            'time'          => 'sometimes|required|date_format:H:i',
            'category'      => 'nullable|string|max:100',
            'notes'         => 'nullable|string',
            'status'        => 'nullable|string|in:pending,approved,completed,cancelled,no_show',
            'is_walk_in'    => 'nullable|boolean',
            'pet_id'        => 'sometimes|required|exists:pets,id',
            'service_id'    => 'nullable|exists:services,id',
            'service_ids'   => 'nullable|array',
            'service_ids.*' => 'exists:services,id',
            'vet_id'        => 'nullable|exists:admins,id',
        ]);

        // Portal owners cannot reassign an appointment to a pet they don't own
        if ($ownerId = $this->getPortalOwnerId()) {
            if (isset($validated['pet_id'])) {
                $pet = \App\Models\Pet::find($validated['pet_id']);
                if (!$pet || $pet->owner_id != $ownerId) {
                    return response()->json(['message' => 'You can only assign appointments to your own pets.'], 403);
                }
            }
        }

        if (isset($validated['service_id'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            if ($service && empty($validated['category'])) {
                $validated['category'] = $service->category;
            }
        }

        if (!empty($validated['vet_id']) && !empty($validated['date']) && !empty($validated['time'])) {
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
                
                $vetName = Admin::find($validated['vet_id'])->name ?? 'the vet';
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
        if (!empty($validated['pet_id']) && !empty($validated['date']) && !empty($validated['time'])) {
            $existingPetAppointment = Appointment::where('pet_id', $validated['pet_id'])
                                                ->where('date', $validated['date'])
                                                ->where('time', $validated['time'])
                                                ->where('id', '!=', $appointment->id)
                                                ->first();
            if ($existingPetAppointment) {
                return response()->json(['message' => 'This pet already has an appointment at this time.'], 422);
            }
        }

        if (!empty($validated['service_id']) && empty($validated['title'])) {
            $service = \App\Models\Service::find($validated['service_id']);
            $validated['title'] = $service ? $service->name : 'General Consultation';
        }

        $serviceIds = $validated['service_ids'] ?? null;
        unset($validated['service_ids']);

        if (!empty($validated['service_id']) && $serviceIds === null) {
            $serviceIds = [$validated['service_id']];
        }

        $appointment->update($validated);

        if ($serviceIds !== null) {
            $appointment->services()->sync($serviceIds);
        }

        $this->invalidatePortalCache($appointment->pet?->owner_id);

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function getAvailability(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'vet_id' => 'nullable|exists:admins,id'
        ]);

        $query = Appointment::where('date', $request->date)
            ->where('status', '!=', 'cancelled');

        if ($request->vet_id) {
            $query->where('vet_id', $request->vet_id);
        }

        $appointments = $query->get(['time', 'vet_id'])->map(function ($a) {
            // Normalize to HH:MM so "9:00" becomes "09:00"
            if ($a->time && strlen($a->time) < 5) {
                $a->time = str_pad($a->time, 5, '0', STR_PAD_LEFT);
            }
            return $a;
        });

        return response()->json($appointments);
    }

    public function destroy(Appointment $appointment)
    {
        $this->authorize('delete', $appointment);
        $ownerId = $appointment->pet?->owner_id;
        $appointmentId = $appointment->id;
        $appointment->delete();
        
        $this->invalidatePortalCache($ownerId);

        // Broadcast for real-time sync
        event(new \App\Events\AppointmentDeleted($appointmentId));

        return response()->json(null, 204);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use Illuminate\Http\Request;
use App\Services\ClientNotificationService;
use App\Traits\HasInternalNotifications;
use App\Traits\IdentifiesPortalOwner;
use App\Enums\Roles;
use Illuminate\Support\Facades\Log;

class AppointmentStatusController extends Controller
{
    use HasInternalNotifications, IdentifiesPortalOwner;

    protected ClientNotificationService $notificationService;

    public function __construct(ClientNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
        $this->middleware('role:' . implode(',', Roles::adminRoles()));
    }

    public function approve(Request $request, Appointment $appointment)
    {
        // Approving fills a place in the slot, so it is refused once the slot
        // already holds SLOT_CAPACITY approved visits. Locked so two staff
        // approving at the same moment cannot both take the last place.
        try {
            $approved = Appointment::withSlotLock($appointment->date, $appointment->time, function () use ($appointment) {
                if (Appointment::slotIsFull($appointment->date, $appointment->time, $appointment->id)) {
                    return false;
                }
                $appointment->status = 'approved';
                $appointment->save();
                return true;
            });
        } catch (\Illuminate\Contracts\Cache\LockTimeoutException $e) {
            return response()->json(['message' => 'Another approval for this time is in progress. Please try again.'], 409);
        }
        if (!$approved) {
            return response()->json([
                'message' => 'This time slot already has ' . Appointment::SLOT_CAPACITY . ' approved appointments. Decline this request or move it to another time.',
            ], 422);
        }

        $this->invalidatePortalCache($appointment->pet?->owner_id);

        // Broadcast status update
        event(new \App\Events\AppointmentStatusUpdated($appointment));

        // Internal admin notification
        $this->createInternalNotification(
            'AppointmentApproved',
            'Appointment Approved',
            "Appointment for {$appointment->pet->name} on " . date('M d, Y', strtotime($appointment->date)) . " has been approved.",
            ['appointment_id' => $appointment->id]
        );

        try {
            $owner = $appointment->pet->owner;
            $this->notificationService->sendFromTemplate(
                $owner,
                'appointment_approved',
                'email',
                [
                    'pet_name' => $appointment->pet->name,
                    'date' => $appointment->date,
                    'time' => date('g:i A', strtotime($appointment->time)),
                ],
                'automated',
                $appointment
            );
        } catch (\Exception $e) {
            Log::error("Failed to send approval notification: " . $e->getMessage());
        }

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function decline(Request $request, Appointment $appointment)
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:10|max:1000',
        ], [
            'reason.required' => 'A decline reason is required.',
            'reason.min'      => 'Decline reason must be at least 10 characters.',
        ]);

        $appointment->status = 'declined';
        $appointment->decline_reason = $validated['reason'];
        $appointment->save();

        // The decline is saved at this point. Everything below only tells
        // people about it, so a failure there is logged rather than turned
        // into a 500 that leaves the screen showing "Failed to decline" for a
        // decline that actually went through. \Throwable, not \Exception: a
        // pet with no owner made sendFromTemplate() throw a TypeError, which
        // \Exception does not catch.
        $petName = $appointment->pet?->name ?? 'a patient';

        $this->invalidatePortalCache($appointment->pet?->owner_id);

        // Real-time update for the admin screens and the owner's portal
        try {
            event(new \App\Events\AppointmentStatusUpdated($appointment));
        } catch (\Throwable $e) {
            Log::error("Failed to broadcast appointment decline: " . $e->getMessage());
        }

        try {
            $this->createInternalNotification(
                'AppointmentDeclined',
                'Appointment Declined',
                "Appointment for {$petName} on " . date('M d, Y', strtotime($appointment->date)) . " has been declined.",
                ['appointment_id' => $appointment->id]
            );
        } catch (\Throwable $e) {
            Log::error("Failed to create decline notification: " . $e->getMessage());
        }

        try {
            $owner = $appointment->pet?->owner;
            if ($owner) {
                $this->notificationService->sendFromTemplate(
                    $owner,
                    'appointment_declined',
                    'email',
                    [
                        'pet_name' => $petName,
                        'date' => $appointment->date,
                        'reason' => $appointment->decline_reason,
                    ],
                    'automated',
                    $appointment
                );
            }
        } catch (\Throwable $e) {
            Log::error("Failed to send decline notification: " . $e->getMessage());
        }

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function complete(Request $request, Appointment $appointment)
    {
        $appointment->status = 'completed';
        $appointment->save();

        $this->invalidatePortalCache($appointment->pet?->owner_id);

        event(new \App\Events\AppointmentStatusUpdated($appointment));

        $this->createInternalNotification(
            'AppointmentCompleted',
            'Appointment Completed',
            "Appointment for {$appointment->pet->name} on " . date('M d, Y', strtotime($appointment->date)) . " has been marked as completed.",
            ['appointment_id' => $appointment->id]
        );

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function remind(Request $request, Appointment $appointment)
    {
        try {
            $owner = $appointment->pet->owner;
            $this->notificationService->sendFromTemplate(
                $owner,
                'appointment_reminder',
                'email',
                [
                    'pet_name' => $appointment->pet->name,
                    'date' => $appointment->date,
                    'time' => date('g:i A', strtotime($appointment->time)),
                ],
                'manual',
                $appointment
            );
             return response()->json(['message' => 'Reminder sent successfully.']);
        } catch (\Exception $e) {
            Log::error("Failed to send reminder: " . $e->getMessage());
            return response()->json(['message' => 'Failed to send reminder: ' . $e->getMessage()], 500);
        }
    }
}

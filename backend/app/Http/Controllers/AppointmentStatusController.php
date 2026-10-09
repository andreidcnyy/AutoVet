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

        $petName = $appointment->pet?->name ?? 'a patient';
        $this->announceStatusChange($appointment, 'AppointmentApproved', 'Appointment Approved', 'has been approved', 'appointment_approved', [
            'pet_name' => $petName,
            'date' => $appointment->date,
            'time' => date('g:i A', strtotime($appointment->time)),
        ]);

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

        $petName = $appointment->pet?->name ?? 'a patient';
        $this->announceStatusChange($appointment, 'AppointmentDeclined', 'Appointment Declined', 'has been declined', 'appointment_declined', [
            'pet_name' => $petName,
            'date' => $appointment->date,
            'reason' => $appointment->decline_reason,
        ]);

        return response()->json($appointment->load(['pet', 'service', 'services', 'vet']));
    }

    public function complete(Request $request, Appointment $appointment)
    {
        $appointment->status = 'completed';
        $appointment->save();

        $this->announceStatusChange($appointment, 'AppointmentCompleted', 'Appointment Completed', 'has been marked as completed');

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

    /**
     * Tells everyone about a status change that is already saved: the
     * real-time update to admin screens and the owner's portal, the staff
     * notification, and (when $emailKey is given) the owner's email.
     *
     * Each step is best-effort. The change has gone through by the time this
     * runs, so a failure here is logged rather than turned into a 500 that
     * makes the screen report a failure for something that succeeded.
     * \Throwable, not \Exception: a pet whose owner is archived made
     * sendFromTemplate() throw a TypeError, which \Exception does not catch,
     * and an unreachable broadcaster throws from ShouldBroadcastNow.
     */
    private function announceStatusChange(Appointment $appointment, string $type, string $title, string $verb, ?string $emailKey = null, array $emailVars = []): void
    {
        $petName = $appointment->pet?->name ?? 'a patient';

        try {
            $this->invalidatePortalCache($appointment->pet?->owner_id);
        } catch (\Throwable $e) {
            Log::error("[{$type}] Failed to clear portal cache: " . $e->getMessage());
        }

        try {
            event(new \App\Events\AppointmentStatusUpdated($appointment));
        } catch (\Throwable $e) {
            Log::error("[{$type}] Failed to broadcast status update: " . $e->getMessage());
        }

        try {
            $this->createInternalNotification(
                $type,
                $title,
                "Appointment for {$petName} on " . date('M d, Y', strtotime($appointment->date)) . " {$verb}.",
                ['appointment_id' => $appointment->id]
            );
        } catch (\Throwable $e) {
            Log::error("[{$type}] Failed to create staff notification: " . $e->getMessage());
        }

        if (!$emailKey) return;

        try {
            $owner = $appointment->pet?->owner;
            if ($owner) {
                $this->notificationService->sendFromTemplate($owner, $emailKey, 'email', $emailVars, 'automated', $appointment);
            }
        } catch (\Throwable $e) {
            Log::error("[{$type}] Failed to email owner: " . $e->getMessage());
        }
    }
}

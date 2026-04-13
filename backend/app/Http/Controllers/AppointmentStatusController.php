<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use Illuminate\Http\Request;
use App\Services\ClientNotificationService;
use Illuminate\Support\Facades\Log;

class AppointmentStatusController extends Controller
{
    protected ClientNotificationService $notificationService;

    public function __construct(ClientNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
        $this->middleware('role:Admin,Veterinarian');
    }

    public function approve(Request $request, Appointment $appointment)
    {
        $appointment->status = 'approved';
        $appointment->save();

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

        return response()->json($appointment->load(['pet', 'service', 'vet']));
    }

    public function decline(Request $request, Appointment $appointment)
    {
        $appointment->status = 'declined';
        $appointment->save();

        try {
            $owner = $appointment->pet->owner;
            $this->notificationService->sendFromTemplate(
                $owner,
                'appointment_declined',
                'email',
                [
                    'pet_name' => $appointment->pet->name,
                    'date' => $appointment->date,
                ],
                'automated',
                $appointment
            );
        } catch (\Exception $e) {
            Log::error("Failed to send decline notification: " . $e->getMessage());
        }

        return response()->json($appointment->load(['pet', 'service', 'vet']));
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

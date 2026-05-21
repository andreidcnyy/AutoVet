<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Owner;
use App\Models\Appointment;
use Carbon\Carbon;

class NewCountsController extends Controller
{
    public function counts(Request $request)
    {
        $user = $request->user();

        $todayMidnight = Carbon::today('UTC');

        $patientsSince     = $user->last_seen_patients_at     && $user->last_seen_patients_at->gt($todayMidnight)
                             ? $user->last_seen_patients_at
                             : $todayMidnight;

        $appointmentsSince = $user->last_seen_appointments_at && $user->last_seen_appointments_at->gt($todayMidnight)
                             ? $user->last_seen_appointments_at
                             : $todayMidnight;

        return response()->json([
            'new_patients'     => Owner::where('created_at', '>', $patientsSince)->count(),
            'new_appointments' => Appointment::where('created_at', '>', $appointmentsSince)->count(),
        ]);
    }

    public function markSeen(Request $request)
    {
        $user = $request->user();
        $now  = Carbon::now('UTC');

        if ($request->boolean('patients')) {
            $user->last_seen_patients_at = $now;
        }
        if ($request->boolean('appointments')) {
            $user->last_seen_appointments_at = $now;
        }

        $user->save();

        return response()->json(['ok' => true]);
    }
}

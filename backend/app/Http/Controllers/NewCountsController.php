<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Owner;
use App\Models\Appointment;

class NewCountsController extends Controller
{
    public function counts(Request $request)
    {
        $sincePatients     = $request->input('since_patients');
        $sinceAppointments = $request->input('since_appointments');

        $patientsQuery = Owner::query();
        if ($sincePatients) {
            $patientsQuery->where('created_at', '>', $sincePatients);
        }

        $appointmentsQuery = Appointment::query();
        if ($sinceAppointments) {
            $appointmentsQuery->where('created_at', '>', $sinceAppointments);
        }

        return response()->json([
            'new_patients'     => $patientsQuery->count(),
            'new_appointments' => $appointmentsQuery->count(),
        ]);
    }
}

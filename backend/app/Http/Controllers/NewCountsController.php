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
        $patientsQuery     = Owner::query();
        $appointmentsQuery = Appointment::query();

        if ($request->filled('since_patients')) {
            try {
                $since = Carbon::parse($request->input('since_patients'));
                $patientsQuery->where('created_at', '>', $since);
            } catch (\Exception $e) {}
        }

        if ($request->filled('since_appointments')) {
            try {
                $since = Carbon::parse($request->input('since_appointments'));
                $appointmentsQuery->where('created_at', '>', $since);
            } catch (\Exception $e) {}
        }

        return response()->json([
            'new_patients'     => $patientsQuery->count(),
            'new_appointments' => $appointmentsQuery->count(),
        ]);
    }
}

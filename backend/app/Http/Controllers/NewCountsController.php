<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Owner;
use App\Models\Appointment;
use Carbon\Carbon;

class NewCountsController extends Controller
{
    public function counts(Request $request)
    {
        $user      = $request->user();
        $path      = $request->input('path', '');
        $now       = Carbon::now();
        $todayStart = Carbon::today(); // midnight in app timezone (UTC)

        // Atomically stamp seen for the page currently open (bypasses audit trail)
        $updates = [];
        if (str_starts_with($path, '/patients'))     $updates['last_seen_patients_at']     = $now;
        if (str_starts_with($path, '/appointments')) $updates['last_seen_appointments_at'] = $now;
        if ($updates) {
            DB::table('admins')->where('id', $user->id)->update($updates);
            // Keep in-memory object in sync for the count queries below
            foreach ($updates as $col => $val) $user->$col = $val;
        }

        // since = max(today_midnight, last_seen) — never goes before today
        $pSince = $user->last_seen_patients_at instanceof Carbon
            ? $user->last_seen_patients_at
            : ($user->last_seen_patients_at ? Carbon::parse($user->last_seen_patients_at) : null);
        $aSince = $user->last_seen_appointments_at instanceof Carbon
            ? $user->last_seen_appointments_at
            : ($user->last_seen_appointments_at ? Carbon::parse($user->last_seen_appointments_at) : null);

        $patientsSince     = ($pSince && $pSince->gt($todayStart)) ? $pSince : $todayStart;
        $appointmentsSince = ($aSince && $aSince->gt($todayStart)) ? $aSince : $todayStart;

        return response()->json([
            'new_patients'     => Owner::where('created_at', '>', $patientsSince)->count(),
            'new_appointments' => Appointment::where('created_at', '>', $appointmentsSince)->count(),
        ]);
    }
}

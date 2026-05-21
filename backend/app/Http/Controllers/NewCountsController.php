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
        $todayStart = Carbon::today();

        // Default to today midnight — shows all of today's new records.
        // If admin has visited the page today, the client sends the visit timestamp;
        // we use it only when it's from today (stale stamps from other days fall back to midnight).
        $pSince = $todayStart;
        $aSince = $todayStart;

        if ($request->filled('since_patients')) {
            try {
                $ts = Carbon::parse($request->input('since_patients'));
                if ($ts->isToday() && $ts->gt($todayStart)) $pSince = $ts;
            } catch (\Exception $e) {}
        }

        if ($request->filled('since_appointments')) {
            try {
                $ts = Carbon::parse($request->input('since_appointments'));
                if ($ts->isToday() && $ts->gt($todayStart)) $aSince = $ts;
            } catch (\Exception $e) {}
        }

        return response()->json([
            'new_patients'     => Owner::where('created_at', '>', $pSince)->count(),
            'new_appointments' => Appointment::where('created_at', '>', $aSince)->count(),
        ]);
    }
}

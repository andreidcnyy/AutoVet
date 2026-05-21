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
        $todayStart = Carbon::today(); // midnight UTC (app timezone)

        // Client sends ISO timestamps stored in sessionStorage.
        // Carbon::parse handles ISO 8601 correctly — no MySQL format issues.
        $pSince = $todayStart;
        $aSince = $todayStart;

        if ($request->filled('since_patients')) {
            try {
                $ts = Carbon::parse($request->input('since_patients'));
                if ($ts->gt($todayStart)) $pSince = $ts;
            } catch (\Exception $e) {}
        }

        if ($request->filled('since_appointments')) {
            try {
                $ts = Carbon::parse($request->input('since_appointments'));
                if ($ts->gt($todayStart)) $aSince = $ts;
            } catch (\Exception $e) {}
        }

        return response()->json([
            'new_patients'     => Owner::where('created_at', '>', $pSince)->count(),
            'new_appointments' => Appointment::where('created_at', '>', $aSince)->count(),
        ]);
    }
}

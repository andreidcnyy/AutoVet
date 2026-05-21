<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Owner;
use App\Models\Appointment;

class NewCountsController extends Controller
{
    public function counts(Request $request)
    {
        return response()->json([
            'total_patients'     => Owner::count(),
            'total_appointments' => Appointment::count(),
        ]);
    }
}

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
            'new_patients'     => Owner::whereDate('created_at', today())->count(),
            'new_appointments' => Appointment::whereDate('created_at', today())->count(),
        ]);
    }
}

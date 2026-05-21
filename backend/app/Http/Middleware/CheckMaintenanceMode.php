<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Closure;
use Illuminate\Http\Request;

class CheckMaintenanceMode
{
    public function handle(Request $request, Closure $next)
    {
        // Only block portal users — admins/vets always pass through
        if ($request->user() instanceof \App\Models\PortalUser) {
            $maintenance = Setting::where('key', 'maintenance_mode')->value('value');
            if ($maintenance === 'true') {
                return response()->json([
                    'message' => 'The system is currently under maintenance. Please try again later.',
                ], 503);
            }
        }

        return $next($request);
    }
}

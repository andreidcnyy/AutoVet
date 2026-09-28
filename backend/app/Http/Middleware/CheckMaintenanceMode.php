<?php

namespace App\Http\Middleware;

use App\Services\MaintenanceWindow;
use Closure;
use Illuminate\Http\Request;

class CheckMaintenanceMode
{
    public function __construct(private MaintenanceWindow $window)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        // Only block portal users — admins/vets always pass through, so the
        // clinic can keep working during its own maintenance window.
        if (!$request->user() instanceof \App\Models\PortalUser) {
            return $next($request);
        }

        $state = $this->window->state();

        // Scheduled but not started: the portal stays usable and the client
        // shows a countdown, which is the whole point of the warning period.
        if (!$state['active']) {
            return $next($request);
        }

        return response()->json([
            'message' => $state['message']
                ?: 'The system is currently under maintenance. Please try again later.',
            'maintenance' => [
                'active' => true,
                'ends_at' => $state['ends_at'],
                'seconds_until_end' => $state['seconds_until_end'],
                'server_time' => $state['server_time'],
            ],
        ], 503);
    }
}

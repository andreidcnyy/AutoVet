<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Services\MaintenanceWindow;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaintenanceController extends Controller
{
    public function __construct(private MaintenanceWindow $window)
    {
    }

    /**
     * The current window.
     *
     * Deliberately unauthenticated: the portal has to show the countdown during
     * the warning period, before anything is blocked, and on the maintenance
     * page itself where the session may already be gone. It exposes nothing but
     * timestamps.
     */
    public function status()
    {
        return response()->json($this->window->state());
    }

    /**
     * Schedules or cancels a window.
     *
     * Durations arrive as a number plus a unit rather than raw seconds, so the
     * admin screen can offer seconds, minutes and hours without doing the
     * arithmetic itself and getting it subtly wrong.
     */
    public function update(Request $request)
    {
        $this->authorizeAdmin($request);

        $units = ['seconds', 'minutes', 'hours'];

        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'starts_in' => 'nullable|integer|min:0|max:86400',
            'starts_in_unit' => ['nullable', Rule::in($units)],
            'lasts_for' => 'nullable|integer|min:0|max:86400',
            'lasts_for_unit' => ['nullable', Rule::in($units)],
            'message' => 'nullable|string|max:500',
        ]);

        if (!$validated['enabled']) {
            return response()->json($this->window->cancel());
        }

        $startsIn = $this->toSeconds(
            $validated['starts_in'] ?? 0,
            $validated['starts_in_unit'] ?? 'minutes'
        );

        // A blank or zero duration means "until I switch it off", which is what
        // the toggle did before this feature existed.
        $lastsFor = isset($validated['lasts_for']) && $validated['lasts_for'] > 0
            ? $this->toSeconds($validated['lasts_for'], $validated['lasts_for_unit'] ?? 'minutes')
            : null;

        return response()->json(
            $this->window->schedule($startsIn, $lastsFor, $validated['message'] ?? null)
        );
    }

    private function toSeconds(int $amount, string $unit): int
    {
        return match ($unit) {
            'hours' => $amount * 3600,
            'minutes' => $amount * 60,
            default => $amount,
        };
    }

    private function authorizeAdmin(Request $request): void
    {
        $role = $request->user()->role ?? null;

        if (!in_array($role, [Roles::SUPER_ADMIN->value, Roles::CLINIC_ADMIN->value], true)) {
            abort(403, 'Unauthorized. This action is restricted to super_admin or clinic_admin.');
        }
    }
}

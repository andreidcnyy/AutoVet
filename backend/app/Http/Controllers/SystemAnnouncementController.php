<?php

namespace App\Http\Controllers;

use App\Models\SystemAnnouncement;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Active platform announcements, for the landing page (public) and the
 * signed-in apps. This was the same closure written out twice in
 * routes/api.php; writes live in SuperAdminDashboardController.
 */
class SystemAnnouncementController extends Controller
{
    public function active(Request $request)
    {
        $request->validate([
            'target' => ['nullable', 'string', Rule::in(['admin', 'portal', 'landing', 'all'])],
        ]);

        $query = SystemAnnouncement::where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('active_until')
                    ->orWhere('active_until', '>=', now('UTC'));
            });

        if ($request->filled('target')) {
            $target = $request->input('target');
            $query->where(function ($q) use ($target) {
                $q->where('target', $target)->orWhere('target', 'all');
            });
        }

        return response()->json(
            $query->orderByDesc('created_at')->orderByDesc('id')->limit(20)
                ->get(['id', 'title', 'message', 'type', 'target', 'active_until', 'created_at'])
        );
    }
}

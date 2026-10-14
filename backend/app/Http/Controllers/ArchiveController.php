<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ArchiveController extends Controller
{
    /**
     * Map types to their Eloquent class models
     */
    protected function getModelClass($type)
    {
        $map = [
            'pets' => \App\Models\Pet::class,
            'owners' => \App\Models\Owner::class,
            'services' => \App\Models\Service::class,
            'inventories' => \App\Models\Inventory::class,
            'admins' => \App\Models\Admin::class,
            'portal_users' => \App\Models\PortalUser::class,
            'cms' => \App\Models\CmsContent::class,
        ];

        return $map[strtolower($type)] ?? null;
    }

    /**
     * Account archives (staff and portal users) are account management, which
     * belongs to managers. A veterinarian could otherwise restore a removed
     * administrator or permanently delete one.
     */
    private const ACCOUNT_TYPES = ['admins', 'portal_users'];

    private function denyAccountTypeUnlessManager(Request $request, string $type)
    {
        if (in_array(strtolower($type), self::ACCOUNT_TYPES, true)
            && !in_array($request->user()->role, \App\Enums\Roles::managerRoles(), true)) {
            return response()->json(['message' => 'Only an administrator can manage archived accounts.'], 403);
        }

        return null;
    }

    /**
     * List portal users with pending deletion (within 30-day grace period)
     */
    public function pendingDeletions(Request $request)
    {
        if ($denied = $this->denyAccountTypeUnlessManager($request, 'portal_users')) {
            return $denied;
        }

        // Include both new flow (deletion_requested_at set) and old flow (soft-deleted only).
        // withTrashed() rather than withoutGlobalScopes(): the latter also
        // dropped the clinic scope and listed every clinic's clients.
        $items = \App\Models\PortalUser::withTrashed()
            ->where(function ($q) {
                $q->whereNotNull('deletion_requested_at')
                  ->orWhereNotNull('deleted_at');
            })
            ->orderByRaw('COALESCE(deletion_requested_at, deleted_at) DESC')
            ->orderByDesc('id')
            ->paginate(20);

        $items->getCollection()->transform(function ($user) {
            $deletionDate  = $user->deletion_requested_at ?? $user->deleted_at;
            $deadline      = $deletionDate->copy()->addDays(30);
            $daysRemaining = max(0, (int) ceil(now()->diffInDays($deadline)));
            $user->days_remaining        = $daysRemaining;
            $user->deletion_requested_at = $deletionDate;
            return $user;
        });

        return response()->json($items);
    }

    /**
     * Cancel a pending deletion (admin recovery)
     */
    public function cancelPendingDeletion(Request $request, $id)
    {
        if ($denied = $this->denyAccountTypeUnlessManager($request, 'portal_users')) {
            return $denied;
        }

        $user = \App\Models\PortalUser::withTrashed()
            ->where(function ($q) {
                $q->whereNotNull('deletion_requested_at')
                  ->orWhereNotNull('deleted_at');
            })
            ->findOrFail($id);

        // Restore soft-deleted account if needed
        if ($user->deleted_at) {
            $user->restore();
        }

        $user->forceFill(['deletion_requested_at' => null])->save();

        return response()->json(['message' => 'Account deletion cancelled. Account has been recovered.']);
    }

    /**
     * List archived items by type
     */
    public function index(Request $request, $type)
    {
        $modelClass = $this->getModelClass($type);
        if (!$modelClass) {
            return response()->json(['message' => 'Invalid archive type'], 400);
        }
        if ($denied = $this->denyAccountTypeUnlessManager($request, $type)) {
            return $denied;
        }

        $query = $modelClass::onlyTrashed();

        // Include relationship for deleter if it exists
        if (method_exists(new $modelClass, 'deleter')) {
            $query->with('deleter:id,name,email');
        }

        $items = $query->orderBy('deleted_at', 'desc')->orderByDesc('id')->paginate(20);
        return response()->json($items);
    }

    /**
     * Restore an archived item
     */
    public function restore(Request $request, $type, $id)
    {
        $modelClass = $this->getModelClass($type);
        if (!$modelClass) {
            return response()->json(['message' => 'Invalid archive type'], 400);
        }
        if ($denied = $this->denyAccountTypeUnlessManager($request, $type)) {
            return $denied;
        }

        $item = $modelClass::onlyTrashed()->findOrFail($id);

        // Optional expiration check if we restrict manual restoration globally
        // if ($item->restore_until && $item->restore_until->isPast()) {
        //     return response()->json(['message' => 'This item has expired and cannot be restored.'], 403);
        // }

        $item->restore();

        return response()->json(['message' => 'Item restored successfully.']);
    }

    /**
     * Force delete an archived item
     */
    public function forceDelete(Request $request, $type, $id)
    {
        $modelClass = $this->getModelClass($type);
        if (!$modelClass) {
            return response()->json(['message' => 'Invalid archive type'], 400);
        }
        if ($denied = $this->denyAccountTypeUnlessManager($request, $type)) {
            return $denied;
        }

        $item = $modelClass::onlyTrashed()->findOrFail($id);

        try {
            $item->forceDelete();
            return response()->json(['message' => 'Item permanently deleted.']);
        } catch (\Illuminate\Database\QueryException $e) {
            // Log the actual error for debugging but don't show it to the user
            \Illuminate\Support\Facades\Log::error("Purge failure for {$type} ID {$id}: " . $e->getMessage());
            
            return response()->json([
                'message' => 'Cannot permanently delete this item because it is referenced in other database records.'
            ], 409);
        } catch (\Exception $e) {
            // preventPermanentDeletionIfReferenced() throws a plain Exception
            // with a message written for the user; anything else is internal.
            $userFacing = $e->getMessage() !== '' && str_starts_with($e->getMessage(), 'Cannot permanently delete');
            if (!$userFacing) {
                \Illuminate\Support\Facades\Log::error("Purge failure for {$type} ID {$id}: " . $e->getMessage());
            }
            return response()->json([
                'message' => $userFacing ? $e->getMessage() : 'Cannot permanently delete this item due to existing dependencies.'
            ], 409);
        }
    }
}

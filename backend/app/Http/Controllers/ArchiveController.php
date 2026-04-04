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
            'users' => \App\Models\User::class,
            'cms' => \App\Models\CmsContent::class,
        ];

        return $map[strtolower($type)] ?? null;
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

        $query = $modelClass::onlyTrashed();

        // Include relationship for deleter if it exists
        if (method_exists(new $modelClass, 'deleter')) {
            $query->with('deleter:id,name,email');
        }

        $items = $query->orderBy('deleted_at', 'desc')->get();
        return response()->json($items);
    }

    /**
     * Restore an archived item
     */
    public function restore($type, $id)
    {
        $modelClass = $this->getModelClass($type);
        if (!$modelClass) {
            return response()->json(['message' => 'Invalid archive type'], 400);
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
    public function forceDelete($type, $id)
    {
        $modelClass = $this->getModelClass($type);
        if (!$modelClass) {
            return response()->json(['message' => 'Invalid archive type'], 400);
        }

        $item = $modelClass::onlyTrashed()->findOrFail($id);

        try {
            $item->forceDelete();
            return response()->json(['message' => 'Item permanently deleted.']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage() ?: 'Cannot permanently delete this item due to existing dependencies.'
            ], 422);
        }
    }
}

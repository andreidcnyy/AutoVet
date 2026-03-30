<?php

namespace App\Http\Controllers;

use App\Enums\Roles;
use App\Models\CmsContent;
use Illuminate\Http\Request;

/**
 * CmsContentController — Website Content Management
 *
 * Manages content blocks for the future pet-owner web portal.
 * Read access is available to all authenticated clinic users.
 * Write access is restricted to Admin and Chief Veterinarian.
 *
 * Content types: announcement | banner | clinic_info | featured_service
 */
class CmsContentController extends Controller
{
    /**
     * List all CMS content, optionally filtered by type and/or published status.
     *
     * GET /api/cms-contents
     * GET /api/cms-contents?type=announcement
     * GET /api/cms-contents?published_only=true
     */
    public function index(Request $request)
    {
        $query = CmsContent::ordered();

        if ($request->filled('type')) {
            $request->validate(['type' => 'string|in:' . implode(',', CmsContent::validTypes())]);
            $query->where('type', $request->type);
        }

        if ($request->boolean('published_only')) {
            $query->published();
        }

        return response()->json($query->get());
    }

    /**
     * Create a new CMS content block.
     *
     * POST /api/cms-contents
     * Roles: Admin, Chief Veterinarian
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'type'          => 'required|string|in:' . implode(',', CmsContent::validTypes()),
            'title'         => 'required|string|max:255',
            'body'          => 'nullable|string',
            'image_path'    => 'nullable|string|max:255',
            'is_published'  => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $content = CmsContent::create($validated);
        return response()->json($content, 201);
    }

    /**
     * Show a specific CMS content block.
     *
     * GET /api/cms-contents/{cmsContent}
     */
    public function show(CmsContent $cmsContent)
    {
        return response()->json($cmsContent);
    }

    /**
     * Update an existing CMS content block.
     *
     * PUT /api/cms-contents/{cmsContent}
     * Roles: Admin, Chief Veterinarian
     */
    public function update(Request $request, CmsContent $cmsContent)
    {
        $validated = $request->validate([
            'type'          => 'sometimes|string|in:' . implode(',', CmsContent::validTypes()),
            'title'         => 'sometimes|string|max:255',
            'body'          => 'nullable|string',
            'image_path'    => 'nullable|string|max:255',
            'is_published'  => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $cmsContent->update($validated);
        return response()->json($cmsContent);
    }

    /**
     * Soft-delete a CMS content block.
     *
     * DELETE /api/cms-contents/{cmsContent}
     * Roles: Admin, Chief Veterinarian
     */
    public function destroy(CmsContent $cmsContent)
    {
        $cmsContent->delete();
        return response()->json(null, 204);
    }
}

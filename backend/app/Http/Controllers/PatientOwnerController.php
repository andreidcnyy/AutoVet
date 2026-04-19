<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PatientOwnerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = auth('admin_api')->user() ?? auth('portal_api')->user();

        // Start with a clean query, optimized to only what's needed for the list
        $query = Owner::select('id', 'name', 'phone', 'email', 'address', 'city', 'province', 'zip', 'created_at')
            ->withCount('pets'); 

        // Efficiently sum total paid across all pets of an owner using a subquery
        $query->addSelect([
            'total_paid_sum' => \App\Models\Invoice::selectRaw('sum(total_amount)')
                ->whereColumn('owner_id', 'owners.id')
                ->where('status', 'paid')
        ]);

        // If admin needs to see the pet names/details in the list, we load only essential columns
        $query->with(['pets' => function($q) {
            $q->select('id', 'owner_id', 'name', 'species_id', 'breed_id', 'photo')
              ->with(['species:id,name', 'breed:id,name']);
        }]);

        if ($user instanceof \App\Models\PortalUser) {
            $query->where('id', $user->owner?->id);
        }

        // Add Search functionality
        if ($request->has('search')) {
            $search = $request->get('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%");
            });
        }

        // Filter: With Pets vs No Pets
        if ($request->has('filter')) {
            $filter = $request->get('filter');
            if ($filter === 'With Pets') {
                $query->has('pets');
            }
        }

        $query->orderBy('created_at', 'desc');

        $perPage = $request->get('per_page', 10);
        return response()->json($query->paginate($perPage));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = auth('admin_api')->user() ?? auth('portal_api')->user();
        if ($user instanceof \App\Models\PortalUser) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|size:11', 
            'email' => 'nullable|string|email:rfc,dns|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ]);

        if (Owner::where('phone', $validated['phone'])->exists()) {
            return response()->json([
                'message' => 'An owner with this phone number already exists.',
                'errors' => ['phone' => ['This phone number is already registered.']]
            ], 422);
        }

        $owner = Owner::create($validated);
        return response()->json($owner, 201);
    }

    public function show(Owner $owner)
    {
        $owner->load(['pets.species', 'pets.breed', 'pets.sizeCategory', 'pets.invoices', 'pets.appointments']);
        $owner->pets->each->append(['total_paid', 'total_due', 'last_visit', 'next_due']);
        return response()->json($owner);
    }

    public function update(Request $request, Owner $owner)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|size:11', 
            'email' => 'nullable|string|email:rfc,dns|max:255',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:255',
        ]);

        $owner->update($validated);
        $owner->load(['pets.species', 'pets.breed', 'pets.sizeCategory', 'pets.invoices', 'pets.appointments']);
        $owner->pets->each->append(['total_paid', 'total_due', 'last_visit', 'next_due']);
        return response()->json($owner);
    }

    public function destroy(Owner $owner)
    {
        $owner->delete();
        return response()->json(null, 204);
    }
}

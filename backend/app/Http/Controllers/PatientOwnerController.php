<?php

namespace App\Http\Controllers;

use App\Events\EntityCreated;
use App\Models\Admin;
use App\Models\Invoice;
use App\Models\Owner;
use App\Models\PortalUser;
use App\Support\ListQuery;
use App\Traits\IdentifiesPortalOwner;
use Illuminate\Http\Request;

class PatientOwnerController extends Controller
{
    use IdentifiesPortalOwner;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = auth()->user();

        if ($request->boolean('minimal')) {
            $query = Owner::select('id', 'name', 'phone', 'email')
                ->where('email', '!=', 'dataset.seeder@autovet.ai');
            if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
                $ownerId = $this->getPortalOwnerId();
                if (! $ownerId) {
                    return response()->json([]);
                }
                $query->where('id', $ownerId);
            }
            if ($request->filled('search')) {
                $search = $request->get('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', ListQuery::contains($search))
                        ->orWhere('phone', 'like', ListQuery::contains($search))
                        ->orWhere('email', 'like', ListQuery::contains($search))
                        ->orWhereHas('pets', fn ($p) => $p->where('name', 'like', ListQuery::contains($search)));
                });
            }

            return response()->json($query->orderBy('name')->get());
        }

        // Optimized query with required relationships and total paid sum calculation
        $query = Owner::with(['pets', 'user'])
            ->addSelect([
                'total_paid_sum' => Invoice::selectRaw('IFNULL(SUM(total), 0)')
                    ->join('pets', 'pets.id', '=', 'invoices.pet_id')
                    ->whereColumn('pets.owner_id', 'owners.id')
                    ->whereIn('invoices.status', ['Paid', 'Finalized']),
            ]);

        // Always hide AI Training Records from the list for Admins/Staff
        $query->where('email', '!=', 'dataset.seeder@autovet.ai');

        if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
            $ownerId = $this->getPortalOwnerId();
            if (! $ownerId) {
                $query->whereRaw('0 = 1');
            } else {
                $query->where('id', $ownerId);
            }
        }

        // Add Search functionality
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', ListQuery::contains($search))
                    ->orWhere('phone', 'like', ListQuery::contains($search))
                    ->orWhere('email', 'like', ListQuery::contains($search))
                    ->orWhere('address', 'like', ListQuery::contains($search))
                    ->orWhere('city', 'like', ListQuery::contains($search))
                    ->orWhere('province', 'like', ListQuery::contains($search))
                    ->orWhere('zip', 'like', ListQuery::contains($search))
                    ->orWhereHas('pets', fn ($p) => $p->where('name', 'like', ListQuery::contains($search)));
            });
        }

        // Filter: With Pets
        if ($request->get('filter') === 'With Pets') {
            $query->has('pets');
        }

        $query->orderBy('id', 'desc');

        $perPage = ListQuery::perPage($request, 10);
        $paginated = $query->paginate($perPage);

        return response()->json($paginated);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = auth()->user();
        if ($user instanceof PortalUser) {
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
                'errors' => ['phone' => ['This phone number is already registered.']],
            ], 422);
        }

        if (! empty($validated['email']) && Owner::where('email', $validated['email'])->exists()) {
            return response()->json([
                'message' => 'An owner with this email already exists.',
                'errors' => ['email' => ['This email is already registered to another owner.']],
            ], 422);
        }

        $owner = Owner::create($validated);

        // Broadcast for real-time dashboard stats
        event(new EntityCreated('owner', $owner->id));

        return response()->json($owner, 201);

    }

    public function show(Owner $owner)
    {
        // Portal users can only view their own owner record
        if (auth()->user() instanceof PortalUser) {
            if ($owner->id !== $this->getPortalOwnerId()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $owner->load(['pets.species', 'pets.breed', 'pets.sizeCategory', 'pets.invoices', 'pets.appointments']);
        $owner->pets->each->append(['total_paid', 'total_due', 'last_visit', 'next_due']);

        return response()->json($owner);
    }

    public function update(Request $request, Owner $owner)
    {
        // Portal users can only update their own owner record
        if (auth()->user() instanceof PortalUser) {
            if ($owner->id !== $this->getPortalOwnerId()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
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

        $owner->update($validated);

        // Sync with PortalUser if exists. The email is the client's sign-in,
        // so it is only copied when present and not already someone else's
        // login: copying a blank one locked the client out, and a taken one
        // failed on the unique index after the owner had already been saved.
        if ($owner->user_id) {
            $user = PortalUser::find($owner->user_id);
            if ($user) {
                $sync = array_intersect_key($validated, array_flip(['name', 'phone', 'address', 'city', 'province', 'zip']));

                $email = $validated['email'] ?? null;
                $emailTaken = $email && (
                    PortalUser::withTrashed()->where('email', $email)->where('id', '!=', $user->id)->exists()
                    || Admin::where('email', $email)->exists()
                );
                if ($email && ! $emailTaken) {
                    $sync['email'] = $email;
                }

                $user->update($sync);
            }
        }

        $owner->load(['pets.species', 'pets.breed', 'pets.sizeCategory', 'pets.invoices', 'pets.appointments']);
        $owner->pets->each->append(['total_paid', 'total_due', 'last_visit', 'next_due']);

        return response()->json($owner);
    }

    public function destroy(Owner $owner)
    {
        // Portal users cannot delete owner records
        if (auth()->user() instanceof PortalUser) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $owner->delete();

        return response()->json(null, 204);
    }

    public function checkDuplicate(Request $request)
    {
        $phone = $request->query('phone');
        $email = $request->query('email');

        if ($phone) {
            $owner = Owner::where('phone', $phone)->first();
            if ($owner) {
                return response()->json(['exists' => true, 'name' => $owner->name, 'id' => $owner->id]);
            }
        }

        if ($email) {
            $owner = Owner::where('email', $email)->first();
            if ($owner) {
                return response()->json(['exists' => true, 'name' => $owner->name, 'id' => $owner->id]);
            }
        }

        return response()->json(['exists' => false]);
    }
}

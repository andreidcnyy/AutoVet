<?php

namespace App\Http\Controllers;

use App\Models\Pet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Traits\IdentifiesPortalOwner;

class PetController extends Controller
{
    use IdentifiesPortalOwner;

    public function __construct()
    {
        $this->authorizeResource(Pet::class, 'pet');
    }

    private function uploadPetPhotoBytes(string $bytes, string $ext): string
    {
        $ext = $ext === 'jpeg' ? 'jpg' : $ext;
        $name = 'pets/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        \App\Models\StoredFile::store($name, $bytes, 'image/' . $ext);
        return $name;
    }

    private function uploadPetPhotoFile(\Illuminate\Http\UploadedFile $file): string
    {
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false) {
            throw new \RuntimeException('Could not read uploaded pet photo from temp');
        }
        // Prefer the extension guessed from the file's actual contents over the
        // client-supplied filename, which the uploader controls.
        $ext = strtolower($file->extension() ?: $file->getClientOriginalExtension() ?: 'png');
        return $this->uploadPetPhotoBytes($contents, $ext);
    }

    /**
     * Eager-load an id/name lookup without the clinic filter.
     *
     * Species and breeds are clinic-scoped, but portal clients have no matching
     * clinic_id, so the scope reduced these relations to null for every pet the
     * portal loaded. A pet then arrived with no species name, which is what
     * silently disabled the species filter on the booking screen and offered
     * the dog and cat vaccines for every pet. Safe to bypass: the pets
     * themselves are already restricted to the caller's own records.
     */
    private function unscopedName(): \Closure
    {
        return fn ($q) => $q
            ->withoutGlobalScope(\App\Models\Scopes\ClinicScope::class)
            ->select('id', 'name');
    }

    public function index(Request $request)
    {
        $user = auth()->user();

        if ($request->boolean('minimal')) {
            $query = Pet::select('id', 'name', 'owner_id', 'species_id', 'breed_id', 'weight')
                ->with(['owner:id,name', 'species' => $this->unscopedName()]);
            
            // Always hide AI Training Records for minimal lists too
            $query->whereHas('owner', function($q) {
                $q->where('email', '!=', 'dataset.seeder@autovet.ai');
            });

            if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
                $ownerId = $this->getPortalOwnerId();
                if (!$ownerId) return response()->json([]);
                $query->where('owner_id', $ownerId);
            } elseif ($request->has('owner_id')) {
                $query->where('owner_id', $request->owner_id);
            }
            return response()->json($query->orderBy('name')->get());
        }

        // Start with optimized query for the list
        $query = Pet::select('id', 'name', 'owner_id', 'species_id', 'breed_id', 'photo', 'sex', 'date_of_birth', 'created_at')
            ->with([
                'owner:id,name,email',
                'species' => $this->unscopedName(),
                'breed' => $this->unscopedName(),
            ]);

        // Always hide AI Training Records from the list for Admins/Staff
        $query->whereHas('owner', function($q) {
            $q->where('email', '!=', 'dataset.seeder@autovet.ai');
        });

        if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
            $ownerId = $this->getPortalOwnerId();
            if (!$ownerId) {
                $query->whereRaw('0 = 1');
            } else {
                $query->where('owner_id', $ownerId);
            }
        } elseif ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }

        // Add Search functionality
        if ($request->has('search')) {
            $search = $request->get('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhereHas('owner', function($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('breed', function($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('species', function($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $query->orderBy('created_at', 'desc');

        $perPage = $request->get('per_page', 12);
        return response()->json($query->paginate($perPage));
    }

    /**
     * Resolves the owner for a portal caller, or aborts with a message that says
     * what actually went wrong. Returning null here used to fall through to the
     * validator, which then reported "the owner id field is required" — a rule
     * the portal never fills in itself, so the real problem stayed hidden.
     *
     * Staff callers pass owner_id explicitly and get null here, unchanged.
     */
    private function resolvePortalOwnerIdOrFail(): ?int
    {
        $user = auth()->user();
        $isOwner = $user && method_exists($user, 'isOwner') && $user->isOwner();

        if (!$isOwner) {
            return null;
        }

        $ownerId = $this->getPortalOwnerId();

        if (!$ownerId) {
            abort(response()->json([
                'message' => 'Your client record could not be found or created. Please contact the clinic so they can restore your profile.',
            ], 422));
        }

        return (int) $ownerId;
    }

    public function store(Request $request)
    {
        if ($resolved = $this->resolvePortalOwnerIdOrFail()) {
            $request->merge(['owner_id' => $resolved]);
        }

        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            // The UI sends a base64 data URL, but the multipart branch below is
            // still reachable, so constrain real uploads to actual images.
            'photo' => $request->hasFile('photo')
                ? ['nullable', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120']
                : ['nullable', 'string'],
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'vet_id' => 'nullable|exists:admins,id',
        ]);

        if ($request->filled('photo') && preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/is', $request->photo, $m)) {
            $validated['photo'] = $this->uploadPetPhotoBytes(base64_decode(str_replace(' ', '+', $m[2])), strtolower($m[1]));
        } elseif ($request->hasFile('photo')) {
            $validated['photo'] = $this->uploadPetPhotoFile($request->file('photo'));
        }

        $clinicalFields = ['chief_complaint', 'findings', 'diagnosis', 'treatment_plan', 'vet_id'];
        $pet = Pet::create(array_diff_key($validated, array_flip($clinicalFields)));

        // Check for clinical fields to create an initial medical record
        if ($request->hasAny(['chief_complaint', 'findings', 'diagnosis', 'treatment_plan'])) {
            $recordVetId = $request->vet_id;
            if (!$recordVetId) {
                $user = auth()->user();
                if ($user && $user->role === \App\Enums\Roles::VETERINARIAN->value) {
                    $recordVetId = $user->id;
                }
            }

            $pet->medicalRecords()->create([
                'chief_complaint' => $request->chief_complaint,
                'findings'        => $request->findings,
                'diagnosis'       => $request->diagnosis,
                'treatment_plan'  => $request->treatment_plan,
                'notes'           => $request->notes,
                'vet_id'          => $recordVetId,
            ]);
        }

        $this->invalidatePortalCache($pet->owner_id);

        // Real-time broadcast is handled centrally in AppServiceProvider
        // (Pet::created), so no explicit event dispatch is needed here.

        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory'])->append(['total_paid', 'total_due', 'last_visit', 'next_due']), 201);
    }

    public function show(Pet $pet)
    {
        // Explicitly load relations and append attributes for the detail view
        return response()->json($pet->load([
                'owner',
                'species' => $this->unscopedName(),
                'breed' => $this->unscopedName(),
                'sizeCategory', 'appointments.service', 'medicalRecords.vet', 'invoices',
            ])
            ->append(['total_paid', 'total_due', 'last_visit', 'next_due']));
    }

    public function update(Request $request, Pet $pet)
    {
        if ($resolved = $this->resolvePortalOwnerIdOrFail()) {
            $request->merge(['owner_id' => $resolved]);
        }

        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'name' => 'required|string|max:255',
            'species_id' => 'nullable|exists:species,id',
            'breed_id' => 'nullable|exists:breeds,id',
            'date_of_birth' => 'nullable|date',
            'age_group' => 'nullable|string',
            'sex' => 'nullable|string',
            'color' => 'nullable|string',
            'weight' => 'required|numeric|min:0.01',
            'weight_unit' => 'nullable|string|exists:units_of_measure,abbreviation',
            'size_category_id' => 'nullable|exists:pet_size_categories,id',
            'status' => 'nullable|string',
            'allergies' => 'nullable|string',
            'medication' => 'nullable|string',
            'notes' => 'nullable|string',
            // The UI sends a base64 data URL, but the multipart branch below is
            // still reachable, so constrain real uploads to actual images.
            'photo' => $request->hasFile('photo')
                ? ['nullable', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120']
                : ['nullable', 'string'],
            'chief_complaint' => 'nullable|string',
            'findings' => 'nullable|string',
            'diagnosis' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'vet_id' => 'nullable|exists:admins,id',
        ]);

        if ($request->filled('photo') && preg_match('/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/is', $request->photo, $m)) {
            $validated['photo'] = $this->uploadPetPhotoBytes(base64_decode(str_replace(' ', '+', $m[2])), strtolower($m[1]));
        } elseif ($request->hasFile('photo')) {
            $validated['photo'] = $this->uploadPetPhotoFile($request->file('photo'));
        } elseif ($request->has('photo') && is_null($request->photo)) {
            // Explicitly removing the photo
            $validated['photo'] = null;
        } else {
            // Keep existing photo if a URL was sent back unchanged
            if (isset($request->photo) && !preg_match('/^data:image/', $request->photo)) {
                // It's likely the existing path, so leave it untouched
                unset($validated['photo']);
            }
        }

        $clinicalFields = ['chief_complaint', 'findings', 'diagnosis', 'treatment_plan', 'vet_id'];
        $pet->update(array_diff_key($validated, array_flip($clinicalFields)));

        // Check for clinical fields to create a NEW medical record entry
        if ($request->hasAny(['chief_complaint', 'findings', 'diagnosis', 'treatment_plan'])) {
            // Only create if at least one clinical field is not empty
            if ($request->chief_complaint || $request->findings || $request->diagnosis || $request->treatment_plan) {
                $recordVetId = $request->vet_id;
                if (!$recordVetId) {
                    $user = auth()->user();
                    if ($user && $user->role === \App\Enums\Roles::VETERINARIAN->value) {
                        $recordVetId = $user->id;
                    }
                }

                $pet->medicalRecords()->create([
                    'chief_complaint' => $request->chief_complaint,
                    'findings'        => $request->findings,
                    'diagnosis'       => $request->diagnosis,
                    'treatment_plan'  => $request->treatment_plan,
                    'notes'           => $request->notes,
                    'vet_id'          => $recordVetId,
                ]);
            }
        }

        $this->invalidatePortalCache($pet->owner_id);

        return response()->json($pet->load(['owner', 'species', 'breed', 'sizeCategory'])
            ->append(['total_paid', 'total_due', 'last_visit', 'next_due']));
    }

    public function destroy(Pet $pet)
    {
        $user = auth()->user();
        $portalOwnerId = $this->getPortalOwnerId();
        $isPortalOwner = $portalOwnerId !== null && (int) $portalOwnerId === (int) $pet->owner_id;

        $isAdminUser = $user && method_exists($user, 'isAdmin') && $user->isAdmin();
        $isClinicalUser = $user && method_exists($user, 'isClinical') && $user->isClinical();

        if (!$isPortalOwner && !$isAdminUser && !$isClinicalUser) {
            return response()->json(['message' => 'Unauthorized. You can only delete your own pet.'], 403);
        }

        $ownerId = $pet->owner_id;
        $pet->delete();
        $this->invalidatePortalCache($ownerId);

        return response()->json(null, 204);
    }
}

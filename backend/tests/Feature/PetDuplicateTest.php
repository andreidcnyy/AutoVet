<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\PortalUser;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** One owner cannot register two pets with the same name. */
class PetDuplicateTest extends TestCase
{
    use RefreshDatabase;

    private Owner $owner;

    private int $speciesId;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active'],
        ]);
        $this->owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
        $this->speciesId = Species::firstOrCreate(['name' => 'Canine'])->id;
    }

    private function asStaff(): void
    {
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);
    }

    private function addPet(string $name, ?int $ownerId = null)
    {
        return $this->postJson('/api/pets', [
            'owner_id' => $ownerId ?? $this->owner->id, 'name' => $name,
            'species_id' => $this->speciesId, 'weight' => 5,
        ]);
    }

    public function test_the_same_pet_cannot_be_added_twice_for_one_owner(): void
    {
        $this->asStaff();
        $this->addPet('Buboy')->assertCreated();

        $this->addPet('Buboy')
            ->assertStatus(422)
            ->assertJsonValidationErrors('name')
            ->assertJsonPath('errors.name.0', fn ($m) => str_contains($m, 'already has a pet named "Buboy"'));

        $this->assertSame(1, Pet::where('owner_id', $this->owner->id)->count());
    }

    public function test_capital_letters_and_extra_spaces_still_count_as_the_same_name(): void
    {
        $this->asStaff();
        $this->addPet('Buboy')->assertCreated();

        $this->addPet('  BUBOY ')->assertStatus(422)->assertJsonValidationErrors('name');
        $this->addPet('buboy')->assertStatus(422)->assertJsonValidationErrors('name');
    }

    public function test_different_owners_may_use_the_same_pet_name(): void
    {
        $this->asStaff();
        $other = Owner::create(['clinic_id' => 1, 'name' => 'Other Client', 'phone' => '09222222222']);

        $this->addPet('Max')->assertCreated();
        $this->addPet('Max', $other->id)->assertCreated();
    }

    public function test_a_pet_cannot_be_renamed_to_another_pet_of_the_same_owner(): void
    {
        $this->asStaff();
        $this->addPet('Max')->assertCreated();
        $coco = $this->addPet('Coco')->assertCreated()->json();

        $payload = ['owner_id' => $this->owner->id, 'species_id' => $this->speciesId, 'weight' => 5];

        $this->putJson("/api/pets/{$coco['id']}", $payload + ['name' => 'max'])
            ->assertStatus(422)->assertJsonValidationErrors('name');

        // Saving a pet under its own name is not a duplicate.
        $this->putJson("/api/pets/{$coco['id']}", $payload + ['name' => 'Coco'])->assertOk();
    }

    public function test_an_archived_pet_does_not_block_the_name(): void
    {
        $this->asStaff();
        $old = $this->addPet('Bantay')->assertCreated()->json();
        Pet::find($old['id'])->delete();

        $this->addPet('Bantay')->assertCreated();
    }

    public function test_a_portal_client_is_told_they_already_have_that_pet(): void
    {
        $client = PortalUser::factory()->create();
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Portal Client', 'email' => $client->email, 'phone' => '09333333333', 'user_id' => $client->id]);
        Sanctum::actingAs($client, ['*']);

        $this->addPet('Mochi', $owner->id)->assertCreated();

        $this->addPet('Mochi', $owner->id)
            ->assertStatus(422)
            ->assertJsonPath('errors.name.0', fn ($m) => str_contains($m, 'You already have a pet named "Mochi"'));
    }
}

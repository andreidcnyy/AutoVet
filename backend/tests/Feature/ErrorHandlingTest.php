<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\Service;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ErrorHandlingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);
    }

    public function test_user_facing_messages_are_shown(): void
    {
        Owner::create(['clinic_id' => 1, 'name' => 'Existing', 'phone' => '09123456789']);
        $species = Species::create(['name' => 'Dog']);
        $service = Service::create(['name' => 'Consultation', 'base_price' => 500]);

        $this->postJson('/api/walk-in', [
            'date' => now()->addDay()->toDateString(),
            'time' => '10:00',
            'service_id' => $service->id,
            'new_owner' => ['name' => 'Someone', 'phone' => '09123456789'],
            'new_pet' => ['name' => 'Rex', 'species_id' => $species->id],
        ])->assertStatus(422)->assertJsonFragment(['message' => "An owner with phone 09123456789 already exists: Existing. Use 'Link Existing Owner' instead."]);
    }

    public function test_internal_errors_stay_generic(): void
    {
        // A CSV whose rows do not match the header used to abort the import
        // with the raw PHP error in the response.
        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('owners.csv', "name,phone,email\nOnly two,cells\n");

        $this->postJson('/api/import/owners', ['file' => $file])
            ->assertStatus(422)
            ->assertJsonMissingPath('error');
    }
}

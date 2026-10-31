<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\PortalUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiRateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
    }

    private function as($user): static
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['*']);
        return $this;
    }

    public function test_every_api_route_is_limited_per_signed_in_user(): void
    {
        $staff = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['id' => 900]);
        $other = Admin::factory()->role(Roles::STAFF->value)->create(['id' => 901]);

        $this->as($staff)->getJson('/api/user')->assertOk()
            ->assertHeader('X-RateLimit-Limit', 300)->assertHeader('X-RateLimit-Remaining', 299);
        $this->as($staff)->getJson('/api/user')->assertHeader('X-RateLimit-Remaining', 298);

        // A colleague behind the same clinic IP has their own allowance.
        $this->as($other)->getJson('/api/user')->assertHeader('X-RateLimit-Remaining', 299);
    }

    public function test_staff_and_client_with_the_same_id_do_not_share_a_limit(): void
    {
        $staff  = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['id' => 900]);
        $client = PortalUser::factory()->create(['id' => 900]);

        $this->as($staff)->getJson('/api/user')->assertHeader('X-RateLimit-Remaining', 299);
        $this->as($client)->getJson('/api/user')->assertHeader('X-RateLimit-Remaining', 299);
    }

    public function test_guests_are_limited_by_address(): void
    {
        $this->getJson('/api/maintenance-status')->assertOk()
            ->assertHeader('X-RateLimit-Limit', 300)->assertHeader('X-RateLimit-Remaining', 299);
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Notification;
use App\Models\PortalUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Clinic One', 'email' => 'one@example.com', 'status' => 'active'],
            ['id' => 2, 'clinic_name' => 'Clinic Two', 'email' => 'two@example.com', 'status' => 'active'],
        ]);
    }

    private function as($user): static
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['*']);
        return $this;
    }

    public function test_staff_and_client_with_the_same_id_do_not_share_notifications(): void
    {
        $staff  = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['id' => 900]);
        $client = PortalUser::factory()->create(['id' => 900]);

        Notification::create([
            'clinic_id' => 1, 'user_id' => null, 'type' => 'LowStockAlert',
            'title' => 'Internal stock alert', 'message' => 'Only staff should see this',
        ]);

        $this->as($staff)->getJson('/api/dashboard/notifications')
            ->assertOk()->assertJsonFragment(['title' => 'Internal stock alert']);

        $this->as($client)->getJson('/api/dashboard/notifications')
            ->assertOk()->assertJsonMissing(['title' => 'Internal stock alert']);
    }

    public function test_staff_cannot_read_the_portal_overview(): void
    {
        $staff = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();

        $this->as($staff)->getJson('/api/portal/overview')->assertForbidden();
    }

    public function test_staff_channels_are_per_clinic(): void
    {
        $staff  = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => 1]);
        $client = PortalUser::factory()->create();

        $channels = (fn () => $this->channels)->call(Broadcast::driver());
        $check = fn ($user, string $name, array $args) => (bool) $channels[$name]($user, ...$args);

        $this->assertTrue($check($staff, 'admin.{clinicId}.{topic}', ['1', 'appointments']));
        $this->assertFalse($check($staff, 'admin.{clinicId}.{topic}', ['2', 'appointments']));
        $this->assertFalse($check($client, 'admin.{clinicId}.{topic}', ['1', 'appointments']));
        $this->assertFalse($check($client, 'notifications.{id}', [$client->id]));
    }
}

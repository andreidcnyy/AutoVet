<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\PortalUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessControlTest extends TestCase
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

    public function test_vet_cannot_create_a_clinic_admin(): void
    {
        $vet = Admin::factory()->role(Roles::VETERINARIAN->value)->create();

        $this->as($vet)->postJson('/api/users', [
            'name' => 'Sneaky', 'email' => 'sneaky@example.com', 'password' => 'password1',
            'role' => Roles::CLINIC_ADMIN->value,
        ])->assertForbidden();

        $this->assertDatabaseMissing('admins', ['email' => 'sneaky@example.com']);
    }

    public function test_vet_can_create_staff(): void
    {
        $vet = Admin::factory()->role(Roles::VETERINARIAN->value)->create();

        $this->as($vet)->postJson('/api/users', [
            'name' => 'Front Desk', 'email' => 'desk@example.com', 'password' => 'password1',
            'role' => Roles::STAFF->value,
        ])->assertCreated()->assertJsonMissingPath('password');
    }

    public function test_vet_cannot_promote_itself(): void
    {
        $vet = Admin::factory()->role(Roles::VETERINARIAN->value)->create();

        $this->as($vet)->putJson("/api/users/{$vet->id}", ['role' => Roles::CLINIC_ADMIN->value])
            ->assertForbidden();

        $this->assertSame(Roles::VETERINARIAN->value, $vet->fresh()->role);
    }

    public function test_vet_cannot_reset_an_admin_password(): void
    {
        $vet   = Admin::factory()->role(Roles::VETERINARIAN->value)->create();
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();

        $this->as($vet)->postJson("/api/users/{$admin->id}/reset-password", ['password' => 'takeover123'])
            ->assertForbidden();
    }

    public function test_clinic_admin_can_add_another_clinic_admin(): void
    {
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();

        $this->as($admin)->postJson('/api/users', [
            'name' => 'Second Admin', 'email' => 'second@example.com', 'password' => 'password1',
            'role' => Roles::CLINIC_ADMIN->value,
        ])->assertCreated();
    }

    public function test_clinic_admin_cannot_create_a_super_admin(): void
    {
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();

        $this->as($admin)->postJson('/api/users', [
            'name' => 'Root', 'email' => 'root@example.com', 'password' => 'password1',
            'role' => Roles::SUPER_ADMIN->value,
        ])->assertForbidden();
    }

    public function test_portal_user_cannot_look_up_owners_by_phone(): void
    {
        $this->as(PortalUser::factory()->create())
            ->getJson('/api/owners/check-duplicate?phone=09123456789')
            ->assertForbidden();
    }

    public function test_vet_cannot_restore_an_archived_admin(): void
    {
        $vet   = Admin::factory()->role(Roles::VETERINARIAN->value)->create();
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();
        $admin->delete();

        $this->as($vet)->postJson("/api/archives/admins/{$admin->id}/restore")->assertForbidden();
        $this->assertSoftDeleted('admins', ['id' => $admin->id]);
    }

    public function test_backup_restore_route_is_gone(): void
    {
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();

        $this->as($admin)->postJson('/api/backups/restore')->assertStatus(405);
    }
}

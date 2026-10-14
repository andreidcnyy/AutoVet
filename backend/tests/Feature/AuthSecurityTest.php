<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\PortalUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
    }

    /** Each request must resolve its own token, not the user cached by the previous one. */
    private function fresh(): static
    {
        $this->app['auth']->forgetGuards();
        return $this;
    }

    private function login(string $email, string $password = 'password', array $extra = [])
    {
        return $this->fresh()->postJson('/api/login', ['email' => $email, 'password' => $password] + $extra);
    }

    public function test_pending_deletion_account_needs_the_password(): void
    {
        $user = PortalUser::factory()->create();
        $user->forceFill(['deletion_requested_at' => now()->subDays(2)])->save();

        $this->login($user->email, 'wrong-password')
            ->assertStatus(401)
            ->assertJsonMissing(['account_pending_deletion' => true]);
    }

    public function test_recovery_token_only_reaches_recovery_routes(): void
    {
        $user = PortalUser::factory()->create();
        Owner::create(['clinic_id' => 1, 'name' => $user->name, 'phone' => '09111111111', 'user_id' => $user->id]);
        $user->forceFill(['deletion_requested_at' => now()->subDays(2)])->save();

        $token = $this->login($user->email)->assertOk()
            ->assertJsonPath('account_pending_deletion', true)
            ->json('token');

        $this->fresh()->withToken($token)->getJson('/api/pets')
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_PENDING_DELETION');

        $full = $this->fresh()->withToken($token)->postJson('/api/profile/recover')
            ->assertOk()->json('token');

        $this->assertNotEmpty($full);
        $this->fresh()->withToken($full)->getJson('/api/pets')->assertOk();
    }

    public function test_unknown_email_and_wrong_password_look_the_same(): void
    {
        $user = PortalUser::factory()->create();

        $unknown = $this->login('nobody@example.com')->assertStatus(401)->json('error');
        $wrong   = $this->login($user->email, 'wrong-password')->assertStatus(401)->json('error');

        $this->assertSame($unknown, $wrong);
    }

    public function test_status_is_not_revealed_without_the_password(): void
    {
        $user = PortalUser::factory()->create(['status' => 'suspended']);

        $this->login($user->email, 'wrong-password')->assertStatus(401);
        $this->login($user->email)->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_archived_portal_user_is_not_restored_by_login(): void
    {
        $user = PortalUser::factory()->create();
        $user->delete();

        $this->login($user->email)->assertStatus(403);
        $this->assertSoftDeleted('portal_users', ['id' => $user->id]);
    }

    public function test_inactive_staff_cannot_log_in(): void
    {
        $admin = Admin::factory()->create(['status' => 'Inactive']);

        $this->login($admin->email)->assertStatus(403)->assertJsonPath('code', 'ACCOUNT_DEACTIVATED');
    }

    public function test_suspension_applies_to_an_open_session(): void
    {
        $user = PortalUser::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->fresh()->withToken($token)->getJson('/api/profile')->assertOk();

        $user->update(['status' => 'suspended']);

        $this->fresh()->withToken($token)->getJson('/api/profile')
            ->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_inactive_clinic_blocks_its_staff(): void
    {
        $admin = Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create();
        DB::table('clinics')->where('id', 1)->update(['status' => 'inactive']);
        \App\Support\AccountStatus::forgetClinic(1);

        $this->login($admin->email)->assertStatus(403)->assertJsonPath('code', 'CLINIC_INACTIVE');
    }

    public function test_register_does_not_delete_an_existing_account(): void
    {
        $user = PortalUser::factory()->create(['email_verified_at' => null]);

        $this->fresh()->postJson('/api/register', ['email' => $user->email]);

        $this->assertDatabaseHas('portal_users', ['id' => $user->id, 'deleted_at' => null]);
    }

    public function test_password_reset_revokes_existing_sessions(): void
    {
        $user = PortalUser::factory()->create();
        $user->createToken('old');
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email, 'token' => bcrypt('reset-token'), 'created_at' => now(),
        ]);

        $this->fresh()->postJson('/api/password/reset', [
            'token' => 'reset-token', 'email' => $user->email,
            'password' => 'new-password-1', 'password_confirmation' => 'new-password-1',
        ])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_portal_status_lookup_is_gone(): void
    {
        $this->fresh()->getJson('/api/portal/check-status?email=a@b.c')->assertNotFound();
    }
}

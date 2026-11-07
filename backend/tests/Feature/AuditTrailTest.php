<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Support\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
    }

    private function admin(): Admin
    {
        return Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => 1, 'name' => 'Dr. Reyes']);
    }

    public function test_updates_keep_only_changed_fields_and_who_did_it(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['*']);
        $staff = Admin::factory()->create(['clinic_id' => 1, 'name' => 'Ana', 'status' => 'active']);

        $staff->update(['status' => 'inactive']);

        $log = AuditLog::withoutGlobalScopes()->where('action', 'updated')->latest('id')->first();
        $this->assertEquals(['status' => 'active', 'name' => 'Ana'], $log->old_values);
        $this->assertEquals(['status' => 'inactive', 'name' => 'Ana'], $log->new_values);
        $this->assertSame('Dr. Reyes', $log->actor_name);
        $this->assertSame('staff', $log->actor_type);
        $this->assertSame('Ana', $log->label);
        $this->assertNotNull($log->request_id);
    }

    public function test_timestamp_only_saves_are_not_logged(): void
    {
        $staff = $this->admin();
        $before = AuditLog::withoutGlobalScopes()->count();

        $staff->touch();

        $this->assertSame($before, AuditLog::withoutGlobalScopes()->count());
    }

    public function test_passwords_never_reach_the_audit_table(): void
    {
        $staff = $this->admin();
        $staff->update(['password' => bcrypt('new-secret-pass')]);

        $raw = DB::table('audit_logs')->pluck('old_values')->merge(DB::table('audit_logs')->pluck('new_values'))->implode(' ');
        $this->assertStringNotContainsString('$2y$', $raw);
        $this->assertStringContainsString(AuditLogger::REDACTED, $raw);
    }

    public function test_old_rows_with_secrets_are_redacted_when_read(): void
    {
        $admin = $this->admin();
        DB::table('audit_logs')->insert([
            'clinic_id' => 1, 'action' => 'created', 'model_type' => Admin::class, 'model_id' => $admin->id,
            'new_values' => json_encode(['name' => 'Old', 'password' => '$2y$10$abcdef']),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Sanctum::actingAs($admin, ['*']);

        $body = $this->getJson('/api/audit-logs?search=Old')->assertOk()->getContent();
        $this->assertStringNotContainsString('$2y$10$abcdef', $body);
    }

    public function test_long_text_is_cut_short(): void
    {
        $admin = $this->admin();
        AuditLogger::record('updated', $admin, ['notes' => ''], ['notes' => str_repeat('x', 5000)], $admin);

        $log = AuditLog::withoutGlobalScopes()->latest('id')->first();
        $this->assertLessThan(600, mb_strlen($log->new_values['notes']));
    }

    public function test_logins_and_failed_logins_are_recorded_without_flooding(): void
    {
        $admin = $this->admin();

        foreach (range(1, 3) as $i) {
            $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'wrong'])->assertStatus(401);
        }
        $this->postJson('/api/login', ['email' => $admin->email, 'password' => 'password'])->assertOk();

        $this->assertSame(1, AuditLog::withoutGlobalScopes()->where('action', 'login_failed')->count());
        $this->assertSame(1, AuditLog::withoutGlobalScopes()->where('action', 'logged_in')->where('actor_name', 'Dr. Reyes')->count());
    }

    public function test_short_record_type_filter_matches(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin, ['*']);
        Admin::factory()->create(['clinic_id' => 1]);

        $this->getJson('/api/audit-logs?model_type=Admin')->assertOk()->assertJsonPath('data.0.model_type', Admin::class);
        $this->getJson('/api/audit-logs?model_type=Invoice')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_entries_past_retention_are_pruned(): void
    {
        $admin = $this->admin();
        config(['services.audit.retention_days' => 30]);
        DB::table('audit_logs')->insert([
            'clinic_id' => 1, 'action' => 'updated', 'model_type' => Admin::class, 'model_id' => $admin->id,
            'created_at' => now()->subDays(40), 'updated_at' => now()->subDays(40),
        ]);

        $this->assertSame(1, AuditLogger::prune());
        $this->assertSame(0, AuditLog::withoutGlobalScopes()->where('created_at', '<', now()->subDays(30))->count());
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\CmsContent;
use App\Models\PortalUser;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExposureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
    }

    public function test_clients_only_get_letterhead_settings(): void
    {
        Setting::create(['clinic_id' => 1, 'key' => 'clinic_name', 'value' => 'Pet Wellness']);
        Setting::create(['clinic_id' => 1, 'key' => 'enable_ai_forecasting', 'value' => 'true']);

        Sanctum::actingAs(PortalUser::factory()->create(), ['*']);

        $this->getJson('/api/settings')->assertOk()
            ->assertJsonPath('clinic_name', 'Pet Wellness')
            ->assertJsonMissingPath('enable_ai_forecasting');
    }

    public function test_clients_do_not_see_unpublished_cms_content(): void
    {
        CmsContent::create(['clinic_id' => 1, 'type' => 'announcement', 'title' => 'Draft news', 'is_published' => false]);

        Sanctum::actingAs(PortalUser::factory()->create(), ['*']);

        $this->getJson('/api/cms-content')->assertOk()->assertJsonMissing(['title' => 'Draft news']);
    }

    public function test_status_reveals_nothing_about_the_database(): void
    {
        $this->getJson('/api/status')->assertOk()->assertExactJson(['status' => 'ok']);
    }

    public function test_security_headers_are_on_web_routes_too(): void
    {
        $this->get('/')->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeaderMissing('X-Powered-By');
    }

    public function test_impersonation_token_is_short_lived_and_audited(): void
    {
        Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => 1]);
        $super = Admin::factory()->role(Roles::SUPER_ADMIN->value)->create();
        Sanctum::actingAs($super, ['*']);

        $this->postJson('/api/super-admin/impersonate/1')->assertOk()
            ->assertJsonStructure(['token', 'expires_at'])
            ->assertJsonMissingPath('admin.password');

        $this->assertDatabaseHas('audit_logs', ['action' => 'impersonated', 'user_id' => $super->id]);
        $this->assertNotNull(DB::table('personal_access_tokens')->where('name', 'impersonation-token')->value('expires_at'));
    }
}

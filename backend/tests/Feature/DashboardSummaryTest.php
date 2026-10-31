<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Http\Controllers\DashboardController;
use App\Models\Admin;
use App\Services\InventoryForecastService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    private const SECTIONS = [
        'stats', 'notifications', 'appointments_today', 'monthly_clients',
        'items_by_category', 'services_by_category',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
    }

    public function test_admin_gets_every_section_in_one_call(): void
    {
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);

        $response = $this->getJson('/api/dashboard/summary')->assertOk();

        foreach ([...self::SECTIONS, 'revenue_summary', 'top_services', 'recent_invoices'] as $key) {
            $this->assertArrayHasKey($key, $response->json('data'), "missing section {$key}");
        }
        $this->assertSame([], $response->json('errors'));
    }

    public function test_staff_do_not_get_sales_sections(): void
    {
        Sanctum::actingAs(Admin::factory()->role(Roles::STAFF->value)->create(), ['*']);

        $data = $this->getJson('/api/dashboard/summary')->assertOk()->json('data');

        foreach (self::SECTIONS as $key) {
            $this->assertArrayHasKey($key, $data);
        }
        $this->assertArrayNotHasKey('revenue_summary', $data);
        $this->assertArrayNotHasKey('recent_invoices', $data);
    }

    public function test_one_failing_section_does_not_take_the_others_down(): void
    {
        // Make the "items by category" section throw; the rest must survive.
        $this->app->bind(DashboardController::class, function ($app) {
            return new class($app->make(InventoryForecastService::class)) extends DashboardController
            {
                public function getItemsByCategory(): JsonResponse
                {
                    throw new \RuntimeException('boom');
                }
            };
        });

        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);

        $response = $this->getJson('/api/dashboard/summary')->assertOk();

        $this->assertArrayNotHasKey('items_by_category', $response->json('data'));
        $this->assertArrayHasKey('items_by_category', $response->json('errors'));
        $this->assertArrayHasKey('stats', $response->json('data'));
        $this->assertArrayHasKey('monthly_clients', $response->json('data'));
        $this->assertStringNotContainsString('boom', $response->getContent());
    }
}

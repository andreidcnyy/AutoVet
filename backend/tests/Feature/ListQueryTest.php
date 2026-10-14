<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ListQueryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);
    }

    public function test_page_size_has_a_ceiling(): void
    {
        $this->getJson('/api/pets?per_page=1000000')->assertOk()->assertJsonPath('per_page', 100);
    }

    public function test_invalid_page_size_is_rejected(): void
    {
        $this->getJson('/api/pets?per_page=-5')->assertStatus(422);
        $this->getJson('/api/pets?per_page=abc')->assertStatus(422);
        $this->getJson('/api/pets?page=0')->assertStatus(422);
    }

    public function test_sort_column_must_be_whitelisted(): void
    {
        $this->getJson('/api/species?sort_by=password')->assertStatus(422);
        $this->getJson('/api/species?sort_direction=sideways')->assertStatus(422);
        $this->getJson('/api/species?sort_by=name&sort_direction=desc')->assertOk();
    }

    public function test_search_wildcards_are_literal(): void
    {
        Species::create(['name' => 'Dog']);

        $this->getJson('/api/species?search=%25')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/species?search=Do')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_report_parameters_are_validated(): void
    {
        $this->getJson('/api/reports/sales/revenue-summary?days=abc')->assertStatus(422);
        $this->getJson('/api/appointments/summary?date_from=2020-01-01&date_to=2026-01-01')->assertStatus(422);
    }
}

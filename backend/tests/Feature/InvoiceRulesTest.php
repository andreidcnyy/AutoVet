<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceRulesTest extends TestCase
{
    use RefreshDatabase;

    private Pet $pet;

    private Service $service;

    private Appointment $appointment;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active'],
            ['id' => 2, 'clinic_name' => 'Other Clinic', 'email' => 'other@example.com', 'status' => 'active'],
        ]);
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);

        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
        $species = Species::create(['name' => 'Dog']);
        $this->pet = Pet::create(['owner_id' => $owner->id, 'name' => 'Rex', 'species_id' => $species->id, 'weight' => 5, 'weight_unit' => 'kg']);
        $this->service = Service::create(['name' => 'Consultation', 'base_price' => 500, 'price' => 500, 'pricing_mode' => 'manual']);
        $this->appointment = Appointment::create([
            'pet_id' => $this->pet->id, 'service_id' => $this->service->id,
            'date' => now()->toDateString(), 'time' => '10:00', 'status' => 'approved',
        ]);
    }

    private function invoicePayload(string $status = 'Draft'): array
    {
        return [
            'pet_id' => $this->pet->id, 'appointment_id' => $this->appointment->id, 'status' => $status,
            'subtotal' => 500, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12,
            'total' => 500, 'amount_paid' => 0,
            'items' => [[
                'item_type' => 'service', 'service_id' => $this->service->id, 'name' => 'Consultation',
                'qty' => 1, 'unit_price' => 500, 'amount' => 500,
            ]],
        ];
    }

    public function test_numbers_follow_the_highest_existing_one(): void
    {
        $prefix = 'VB-'.now()->format('Y-m').'-';
        Invoice::create([
            'clinic_id' => 2, 'invoice_number' => $prefix.'0007', 'pet_id' => $this->pet->id, 'status' => 'Draft',
            'subtotal' => 1, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12, 'total' => 1, 'amount_paid' => 0,
        ]);

        $this->postJson('/api/invoices', $this->invoicePayload())
            ->assertCreated()
            ->assertJsonPath('invoice_number', $prefix.'0008');
    }

    public function test_finalized_invoice_cannot_go_back_to_draft(): void
    {
        $invoice = Invoice::create([
            'invoice_number' => 'VB-TEST-0002', 'pet_id' => $this->pet->id, 'status' => 'Finalized',
            'subtotal' => 500, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12,
            'total' => 500, 'amount_paid' => 0,
        ]);

        $this->putJson("/api/invoices/{$invoice->id}", $this->invoicePayload('Draft'))->assertStatus(409);
        $this->assertSame('Finalized', $invoice->fresh()->status);
    }

    public function test_status_filter_as_a_list_is_rejected_cleanly(): void
    {
        $this->getJson('/api/appointments?status[]=approved')->assertStatus(422);
    }
}

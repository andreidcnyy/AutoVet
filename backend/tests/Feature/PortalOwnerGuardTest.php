<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\PortalUser;
use App\Models\Service;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PortalOwnerGuardTest extends TestCase
{
    use RefreshDatabase;

    private PortalUser $client;
    private Pet $pet;
    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active']);

        $this->client = PortalUser::factory()->create();
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'email' => $this->client->email, 'phone' => '09111111111', 'user_id' => $this->client->id]);
        $species = Species::create(['name' => 'Dog']);
        $this->pet = Pet::create(['owner_id' => $owner->id, 'name' => 'Rex', 'species_id' => $species->id, 'weight' => 5, 'weight_unit' => 'kg']);
        $this->service = Service::create(['name' => 'Consultation', 'base_price' => 500]);

        Sanctum::actingAs($this->client, ['*']);
    }

    public function test_client_booking_is_always_pending(): void
    {
        $this->postJson('/api/appointments', [
            'pet_id' => $this->pet->id,
            'service_id' => $this->service->id,
            'date' => now()->addDays(3)->toDateString(),
            'time' => '10:00',
            'status' => 'approved',
            'is_walk_in' => true,
        ])->assertCreated()->assertJsonPath('status', 'pending');
    }

    public function test_client_cannot_approve_their_own_appointment(): void
    {
        $appt = Appointment::create([
            'pet_id' => $this->pet->id, 'service_id' => $this->service->id,
            'date' => now()->addDays(3)->toDateString(), 'time' => '10:00', 'status' => 'pending',
        ]);

        $this->putJson("/api/appointments/{$appt->id}", ['status' => 'approved'])->assertForbidden();
        $this->assertSame('pending', $appt->fresh()->status);
    }

    public function test_client_can_cancel_their_own_appointment(): void
    {
        $appt = Appointment::create([
            'pet_id' => $this->pet->id, 'service_id' => $this->service->id,
            'date' => now()->addDays(3)->toDateString(), 'time' => '10:00', 'status' => 'pending',
        ]);

        $this->putJson("/api/appointments/{$appt->id}", ['status' => 'cancelled'])
            ->assertOk()->assertJsonPath('status', 'cancelled');
    }

    public function test_client_cannot_write_a_medical_record_through_the_pet_form(): void
    {
        $this->putJson("/api/pets/{$this->pet->id}", [
            'name' => 'Rex', 'weight' => 5,
            'diagnosis' => 'Forged diagnosis', 'vet_id' => 1,
        ])->assertOk();

        $this->assertDatabaseMissing('medical_records', ['diagnosis' => 'Forged diagnosis']);
    }

    public function test_client_cannot_open_a_draft_invoice(): void
    {
        $invoice = Invoice::create([
            'invoice_number' => 'VB-TEST-0001', 'pet_id' => $this->pet->id, 'status' => 'Draft',
            'subtotal' => 100, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12,
            'total' => 100, 'amount_paid' => 0,
        ]);

        $this->getJson("/api/invoices/{$invoice->id}")->assertForbidden();
    }
}

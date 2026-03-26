<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class AppointmentIntegrityTest extends TestCase
{
    /**
     * A basic feature test example.
     */
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure some initial data for lookups if needed
    }

    private function createDependencies()
    {
        $owner = \App\Models\Owner::create(['name' => 'John Doe', 'email' => 'john@example.com', 'phone' => '09123456789']);
        $species = \App\Models\Species::create(['name' => 'Dog']);
        
        // Use DB directly to ensure we have a record in both tables if they are linked
        $petId = \Illuminate\Support\Facades\DB::table('pets')->insertGetId([
            'name' => 'Buddy',
            'owner_id' => $owner->id,
            'species_id' => $species->id,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // If 'patients' table is still acting as a constraint target, add a record there too
        if (\Illuminate\Support\Facades\Schema::hasTable('patients')) {
            \Illuminate\Support\Facades\DB::table('patients')->insert([
                'id' => $petId,
                'name' => 'Buddy',
                'species' => 'Dog',
                'owner_name' => 'John Doe',
                'owner_phone' => '09123456789',
                'owner_email' => 'john@example.com',
                'owner_address' => '123 Street',
                'owner_city' => 'City',
                'owner_province' => 'Province',
                'owner_zip' => '1234',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        $service = \App\Models\Service::create(['name' => 'Consultation', 'base_price' => 500]);

        return [$petId, $service->id];
    }

    public function test_appointment_can_be_created_with_status(): void
    {
        [$petId, $serviceId] = $this->createDependencies();

        $data = [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'date' => now()->addDay()->format('Y-m-d'),
            'time' => '10:00',
            'status' => 'pending',
            'notes' => 'Test appointment'
        ];

        $response = $this->postJson('/api/appointments', $data);

        $response->assertStatus(201)
                 ->assertJsonPath('status', 'pending');
    }

    public function test_prevents_double_booking_for_same_pet(): void
    {
        [$petId, $serviceId] = $this->createDependencies();
        $date = now()->addDay()->format('Y-m-d');
        $time = '14:00';

        \App\Models\Appointment::create([
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'date' => $date,
            'time' => $time,
            'title' => 'First'
        ]);

        $data = [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'date' => $date,
            'time' => $time,
            'notes' => 'Second (Double)'
        ];

        $response = $this->postJson('/api/appointments', $data);

        $response->assertStatus(422)
                 ->assertJson(['message' => 'This pet already has an appointment at this time.']);
    }

    public function test_appointment_status_can_be_updated(): void
    {
        [$petId, $serviceId] = $this->createDependencies();
        
        $appointment = \App\Models\Appointment::create([
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'date' => now()->addDay()->format('Y-m-d'),
            'time' => '11:00',
            'status' => 'pending'
        ]);

        $response = $this->putJson("/api/appointments/{$appointment->id}", [
            'pet_id' => $appointment->pet_id,
            'service_id' => $appointment->service_id,
            'date' => $appointment->date,
            'time' => '11:00',
            'status' => 'completed'
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('status', 'completed');
    }
}

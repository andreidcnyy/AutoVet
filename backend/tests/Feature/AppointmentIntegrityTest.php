<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use App\Models\Owner;
use App\Models\Species;
use App\Models\Pet;
use App\Models\Service;
use App\Models\VetSchedule;
use App\Enums\Roles;
use Carbon\Carbon; // Import Carbon

class AppointmentIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $vetUser;
    protected $appointmentDate; // Store date for consistent testing
    protected $appointmentDayOfWeek; // Store day of week for consistent testing

    protected function setUp(): void
    {
        parent::setUp();
        $this->adminUser = User::factory()->create(['role' => Roles::ADMIN->value]);
        $this->vetUser = User::factory()->create(['role' => Roles::VETERINARIAN->value]);

        // Define a fixed date for tests to ensure VetSchedule matching.
        // Using 2026-04-17, which is a Friday.
        $this->appointmentDate = Carbon::parse('2026-04-17'); // Friday
        $this->appointmentDayOfWeek = $this->appointmentDate->format('l'); // Friday

        // Create a VetSchedule for the vet user on the chosen day.
        VetSchedule::create([
            'user_id' => $this->vetUser->id,
            'day_of_week' => $this->appointmentDayOfWeek, 
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
            'is_available' => true,
        ]);
    }

    private function createDependencies(): array
    {
        $owner = Owner::create(['name' => 'John Doe', 'email' => 'john@example.com', 'phone' => '09123456789']);
        $species = Species::create(['name' => 'Dog']);

        $pet = Pet::create([
            'name' => 'Buddy',
            'owner_id' => $owner->id,
            'species_id' => $species->id,
            'weight' => 10,
            'weight_unit' => 'kg',
            'date_of_birth' => now()->subYears(2)->format('Y-m-d') // Add a DOB to avoid Pet::saving issues
        ]);

        $service = Service::create(['name' => 'Consultation', 'base_price' => 500]);

        // Re-added vetId
        return [$pet->id, $service->id, $this->vetUser->id];
    }

    public function test_appointment_can_be_created_with_status(): void
    {
        $this->actingAs($this->adminUser);
        [$petId, $serviceId, $vetId] = $this->createDependencies();

        $data = [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'vet_id' => $vetId, // Include vet_id
            'date' => $this->appointmentDate->format('Y-m-d'), // Use consistent date
            'time' => '10:00', // Match validation rule H:i
            'status' => 'pending',
            'notes' => 'Test appointment'
        ];

        $response = $this->postJson('/api/appointments', $data);

        $response->assertStatus(201)
                 ->assertJsonPath('status', 'pending');
    }

    public function test_prevents_double_booking_for_same_pet(): void
    {
        $this->actingAs($this->adminUser);
        [$petId, $serviceId, $vetId] = $this->createDependencies();
        $date = $this->appointmentDate->format('Y-m-d'); // Use consistent date
        $time = '14:00'; // Match validation rule H:i

        // Create the first appointment
        \App\Models\Appointment::create([
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'vet_id' => $vetId,
            'date' => $date,
            'time' => $time, // Use H:i format
            'title' => 'First'
        ]);

        // Attempt to create a second appointment at the same time for the same pet
        $data = [
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'vet_id' => $vetId,
            'date' => $date,
            'time' => $time, // Ensure time format consistency
            'notes' => 'Second (Double)'
        ];

        $response = $this->postJson('/api/appointments', $data);

        $response->assertStatus(422)
                 ->assertJson(['message' => 'This vet already has an appointment at this time.']);
    }

    public function test_appointment_status_can_be_updated(): void
    {
        $this->actingAs($this->adminUser);
        [$petId, $serviceId, $vetId] = $this->createDependencies();
        
        $date = $this->appointmentDate->format('Y-m-d'); // Use consistent date
        $time = '11:00'; // Match validation rule H:i

        // Create an appointment
        $appointment = \App\Models\Appointment::create([
            'pet_id' => $petId,
            'service_id' => $serviceId,
            'vet_id' => $vetId,
            'date' => $date,
            'time' => $time, // Ensure time format consistency
            'status' => 'pending'
        ]);

        // Update the status, passing all required fields
        $response = $this->putJson("/api/appointments/{$appointment->id}", [
            'pet_id' => $appointment->pet_id,
            'service_id' => $appointment->service_id,
            'vet_id' => $appointment->vet_id,
            'date' => $appointment->date,
            'time' => $appointment->time, // Ensure time format consistency
            'status' => 'completed' // The field to be updated
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('status', 'completed');
    }
}

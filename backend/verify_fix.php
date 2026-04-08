<?php
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;
use App\Models\Pet;
use App\Models\Service;
use App\Models\User;

try {
    // Try to find a valid pet, service, and vet to create a real test appointment
    $pet = Pet::first();
    $service = Service::first();
    $vet = User::where('role', 'like', '%vet%')->orWhere('role', 'like', '%doctor%')->first();

    if (!$pet || !$service) {
        die("Need at least one pet and one service to test.\n");
    }

    echo "Attempting to create test appointment for Pet ID: {$pet->id}...\n";

    $appointment = Appointment::create([
        'pet_id' => $pet->id,
        'service_id' => $service->id,
        'vet_id' => $vet ? $vet->id : null,
        'date' => date('Y-m-d'),
        'time' => '10:00',
        'title' => 'Test Repair Fix',
        'notes' => 'This is a test appointment to verify the schema fix.',
        'status' => 'pending',
        'uuid' => (string) \Illuminate\Support\Str::uuid(),
    ]);

    echo "Success! Appointment created with ID: {$appointment->id}\n";
    
    // Clean up
    $appointment->delete();
    echo "Test appointment deleted.\n";

} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

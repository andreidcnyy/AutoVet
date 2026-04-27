<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use App\Models\Clinic;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BulkProductionMockSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) return;

        $canine = Species::where('name', 'Canine')->first();
        $feline = Species::where('name', 'Feline')->first();

        $breeds = Breed::all();
        if ($breeds->isEmpty()) {
            $this->call(StandardBreedsSeeder::class);
            $breeds = Breed::all();
        }

        $services = Service::all();
        if ($services->isEmpty()) {
            $this->call(ServicesSeeder::class);
            $services = Service::all();
        }

        // Create 55 more owners to reach 50+ total
        for ($i = 1; $i <= 55; $i++) {
            $owner = Owner::create([
                'name' => "Production Client {$i}",
                'email' => "client.prod.{$i}@autovet.ph",
                'phone' => "0917" . str_pad(rand(0, 9999999), 7, '0', STR_PAD_LEFT),
                'address' => "Metro Manila",
                'clinic_id' => $clinic->id,
            ]);

            // Each owner has 1-2 pets
            $numPets = rand(1, 2);
            for ($j = 1; $j <= $numPets; $j++) {
                $species = rand(0, 1) == 0 ? $canine : $feline;
                $breed = $breeds->where('species_id', $species->id)->random();
                
                $pet = Pet::create([
                    'name' => "Pet {$i}-{$j}",
                    'owner_id' => $owner->id,
                    'species_id' => $species->id,
                    'breed_id' => $breed->id,
                    'date_of_birth' => Carbon::now()->subMonths(rand(6, 120))->toDateString(),
                    'weight' => rand(2, 30),
                    'weight_unit' => 'kg',
                    'status' => 'Active',
                    'sex' => rand(0, 1) == 0 ? 'Male' : 'Female',
                    'clinic_id' => $clinic->id,
                ]);

                // Also create an appointment for some pets
                if (rand(0, 1) == 0) {
                    Appointment::create([
                        'pet_id' => $pet->id,
                        'service_id' => $services->random()->id,
                        'title' => 'Routine Checkup',
                        'date' => Carbon::now()->addDays(rand(-30, 30))->toDateString(),
                        'time' => '09:00 AM',
                        'status' => rand(0, 1) == 0 ? 'Completed' : 'Scheduled',
                        'clinic_id' => $clinic->id,
                    ]);
                }

                // Create some invoices
                if (rand(0, 1) == 0) {
                    $total = rand(500, 5000);
                    Invoice::create([
                        'invoice_number' => 'INV-PROD-' . strtoupper(Str::random(6)),
                        'pet_id' => $pet->id,
                        'status' => 'Paid',
                        'total' => $total,
                        'subtotal' => $total,
                        'clinic_id' => $clinic->id,
                    ]);
                }
            }
        }
    }
}

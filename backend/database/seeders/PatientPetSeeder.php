<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\Breed;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PatientPetSeeder extends Seeder
{
    public function run(): void
    {
        $canine = Species::where('name', 'Canine')->first();
        $feline = Species::where('name', 'Feline')->first();
        $rabbit = Species::where('name', 'Rabbit')->first();
        $bird = Species::where('name', 'Bird')->first();

        // Ensure we have at least some basic species if they were missing (unlikely given previous check)
        if (!$canine) $canine = Species::create(['name' => 'Canine', 'status' => 'Active']);
        if (!$feline) $feline = Species::create(['name' => 'Feline', 'status' => 'Active']);

        $ownersData = [
            [
                'name' => 'Maria Santos',
                'email' => 'maria.santos@example.com',
                'phone' => '09171234567',
                'address' => '456 Rizal St',
                'city' => 'Quezon City',
                'province' => 'Metro Manila',
                'zip' => '1100',
                'pets' => [
                    [
                        'name' => 'Luna',
                        'species_id' => $feline->id,
                        'breed_name' => 'Persian Cat',
                        'sex' => 'Female',
                        'weight' => 4.2,
                        'color' => 'White',
                    ],
                    [
                        'name' => 'Coco',
                        'species_id' => $canine->id,
                        'breed_name' => 'Poodle',
                        'sex' => 'Male',
                        'weight' => 6.5,
                        'color' => 'Brown',
                    ]
                ]
            ],
            [
                'name' => 'Juan Dela Cruz',
                'email' => 'juan.delacruz@example.com',
                'phone' => '09187654321',
                'address' => '789 Bonifacio Ave',
                'city' => 'Makati City',
                'province' => 'Metro Manila',
                'zip' => '1200',
                'pets' => [
                    [
                        'name' => 'Tagpi',
                        'species_id' => $canine->id,
                        'breed_name' => 'Aspin',
                        'sex' => 'Male',
                        'weight' => 12.0,
                        'color' => 'Black and White',
                    ]
                ]
            ],
            [
                'name' => 'Elena Reyes',
                'email' => 'elena.reyes@example.com',
                'phone' => '09191112233',
                'address' => '101 Mabini St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip' => '1000',
                'pets' => [
                    [
                        'name' => 'Muning',
                        'species_id' => $feline->id,
                        'breed_name' => 'Siamese Cat',
                        'sex' => 'Female',
                        'weight' => 3.8,
                        'color' => 'Cream',
                    ]
                ]
            ],
            [
                'name' => 'Ricardo Dalisay',
                'email' => 'cardoz0@example.com',
                'phone' => '09203334455',
                'address' => '202 Agila St',
                'city' => 'Pasig City',
                'province' => 'Metro Manila',
                'zip' => '1600',
                'pets' => [
                    [
                        'name' => 'Bantay',
                        'species_id' => $canine->id,
                        'breed_name' => 'German Shepherd',
                        'sex' => 'Male',
                        'weight' => 28.5,
                        'color' => 'Black and Tan',
                    ]
                ]
            ],
            [
                'name' => 'Liza Soberano',
                'email' => 'liza.s@example.com',
                'phone' => '09215556677',
                'address' => '303 Star Blvd',
                'city' => 'Taguig',
                'province' => 'Metro Manila',
                'zip' => '1630',
                'pets' => [
                    [
                        'name' => 'Bella',
                        'species_id' => $canine->id,
                        'breed_name' => 'Shih Tzu',
                        'sex' => 'Female',
                        'weight' => 5.2,
                        'color' => 'White and Gold',
                    ]
                ]
            ],
            [
                'name' => 'Enrique Gil',
                'email' => 'enrique.g@example.com',
                'phone' => '09226667788',
                'address' => '404 Galaxy Ave',
                'city' => 'Muntinlupa',
                'province' => 'Metro Manila',
                'zip' => '1770',
                'pets' => [
                    [
                        'name' => 'Sky',
                        'species_id' => $canine->id,
                        'breed_name' => 'Siberian Husky',
                        'sex' => 'Male',
                        'weight' => 22.0,
                        'color' => 'Grey and White',
                    ]
                ]
            ],
            [
                'name' => 'Kathryn Bernardo',
                'email' => 'kath.b@example.com',
                'phone' => '09237778899',
                'address' => '505 Moon St',
                'city' => 'Quezon City',
                'province' => 'Metro Manila',
                'zip' => '1101',
                'pets' => [
                    [
                        'name' => 'Snow',
                        'species_id' => $feline->id,
                        'breed_name' => 'British Shorthair',
                        'sex' => 'Female',
                        'weight' => 4.5,
                        'color' => 'Blue/Grey',
                    ]
                ]
            ],
            [
                'name' => 'Daniel Padilla',
                'email' => 'daniel.p@example.com',
                'phone' => '09248889900',
                'address' => '606 Rock Rd',
                'city' => 'Caloocan',
                'province' => 'Metro Manila',
                'zip' => '1400',
                'pets' => [
                    [
                        'name' => 'Shadow',
                        'species_id' => $canine->id,
                        'breed_name' => 'Labrador Retriever',
                        'sex' => 'Male',
                        'weight' => 32.0,
                        'color' => 'Black',
                    ]
                ]
            ],
            [
                'name' => 'Anne Curtis',
                'email' => 'anne.c@example.com',
                'phone' => '09259990011',
                'address' => '707 Showtime Cir',
                'city' => 'Makati',
                'province' => 'Metro Manila',
                'zip' => '1201',
                'pets' => [
                    [
                        'name' => 'Pixie',
                        'species_id' => $feline->id,
                        'breed_name' => 'Scottish Fold',
                        'sex' => 'Female',
                        'weight' => 3.5,
                        'color' => 'Calico',
                    ]
                ]
            ],
            [
                'name' => 'Piolo Pascual',
                'email' => 'piolo.p@example.com',
                'phone' => '09260001122',
                'address' => '808 Eternal Dr',
                'city' => 'Pasig',
                'province' => 'Metro Manila',
                'zip' => '1601',
                'pets' => [
                    [
                        'name' => 'Bruno',
                        'species_id' => $canine->id,
                        'breed_name' => 'Boxer',
                        'sex' => 'Male',
                        'weight' => 28.0,
                        'color' => 'Fawn',
                    ]
                ]
            ],
            [
                'name' => 'Vice Ganda',
                'email' => 'vice.g@example.com',
                'phone' => '09271112233',
                'address' => '909 Rainbow Way',
                'city' => 'Quezon City',
                'province' => 'Metro Manila',
                'zip' => '1102',
                'pets' => [
                    [
                        'name' => 'Ganda',
                        'species_id' => $canine->id,
                        'breed_name' => 'Chihuahua',
                        'sex' => 'Female',
                        'weight' => 2.1,
                        'color' => 'Tan',
                    ]
                ]
            ],
            [
                'name' => 'Marian Rivera',
                'email' => 'marian.r@example.com',
                'phone' => '09282223344',
                'address' => '111 Primetime Ln',
                'city' => 'Marikina',
                'province' => 'Metro Manila',
                'zip' => '1800',
                'pets' => [
                    [
                        'name' => 'Bambi',
                        'species_id' => $canine->id,
                        'breed_name' => 'Beagle',
                        'sex' => 'Female',
                        'weight' => 10.5,
                        'color' => 'Tricolor',
                    ]
                ]
            ],
            [
                'name' => 'Dingdong Dantes',
                'email' => 'dingdong.d@example.com',
                'phone' => '09293334455',
                'address' => '222 Hero Blvd',
                'city' => 'Parañaque',
                'province' => 'Metro Manila',
                'zip' => '1700',
                'pets' => [
                    [
                        'name' => 'Rocky',
                        'species_id' => $canine->id,
                        'breed_name' => 'Rottweiler',
                        'sex' => 'Male',
                        'weight' => 45.0,
                        'color' => 'Black and Mahogany',
                    ]
                ]
            ],
            [
                'name' => 'Catriona Gray',
                'email' => 'catriona.g@example.com',
                'phone' => '09304445566',
                'address' => '333 Lava Walk',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip' => '1001',
                'pets' => [
                    [
                        'name' => 'Universe',
                        'species_id' => $feline->id,
                        'breed_name' => 'Maine Coon',
                        'sex' => 'Female',
                        'weight' => 7.2,
                        'color' => 'Brown Tabby',
                    ]
                ]
            ],
        ];

        foreach ($ownersData as $data) {
            $petsData = $data['pets'];
            unset($data['pets']);

            $owner = Owner::firstOrCreate(
                ['email' => $data['email']],
                $data
            );

            foreach ($petsData as $petData) {
                $breedName = $petData['breed_name'];
                unset($petData['breed_name']);

                $breed = Breed::firstOrCreate([
                    'name' => $breedName,
                    'species_id' => $petData['species_id']
                ]);

                $petData['owner_id'] = $owner->id;
                $petData['breed_id'] = $breed->id;
                $petData['date_of_birth'] = Carbon::now()->subMonths(rand(6, 60))->toDateString();
                $petData['status'] = 'Active';
                $petData['weight_unit'] = 'kg';

                $pet = Pet::firstOrCreate(
                    [
                        'owner_id' => $owner->id,
                        'name' => $petData['name']
                    ],
                    $petData
                );

                // Sync to legacy patients table if it exists
                if (DB::connection()->getSchemaBuilder()->hasTable('patients')) {
                    DB::table('patients')->updateOrInsert(
                        ['id' => $pet->id],
                        [
                            'name' => $pet->name,
                            'species' => $pet->species->name,
                            'owner_name' => $owner->name,
                            'owner_email' => $owner->email,
                            'status' => 'Healthy',
                            'created_at' => $pet->created_at ?? now(),
                            'updated_at' => $pet->updated_at ?? now()
                        ]
                    );
                }
            }
        }
    }
}

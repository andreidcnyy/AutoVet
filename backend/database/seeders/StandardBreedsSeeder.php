<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Species;
use App\Models\PetSizeCategory;
use App\Models\Breed;
use App\Models\Clinic;

class StandardBreedsSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        $speciesNames = ['Canine', 'Feline', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];

        foreach ($speciesNames as $name) {
            Species::updateOrCreate(
                ['name' => $name, 'clinic_id' => $clinic->id],
                ['status' => 'Active', 'clinic_id' => $clinic->id]
            );
        }

        $sizeMap = [
            'Small' => PetSizeCategory::where('name', 'Small')->where('clinic_id', $clinic->id)->value('id'),
            'Medium' => PetSizeCategory::where('name', 'Medium')->where('clinic_id', $clinic->id)->value('id'),
            'Large' => PetSizeCategory::where('name', 'Large')->where('clinic_id', $clinic->id)->value('id'),
            'Giant' => PetSizeCategory::where('name', 'Giant')->where('clinic_id', $clinic->id)->value('id'),
        ];

        $data = [
            'Canine' => [
                'Small' => ['Chihuahua', 'Pomeranian', 'Shih Tzu', 'Yorkshire Terrier', 'Toy Poodle', 'Mini Pinscher'],
                'Medium' => ['Beagle', 'Cocker Spaniel', 'Border Collie', 'Standard Schnauzer', 'Aspin'],
                'Large' => ['Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Doberman', 'Rottweiler', 'Siberian Husky'],
            ],
            'Feline' => [
                'Small' => ['Singapura', 'Munchkin', 'Devon Rex'],
                'Medium' => ['Persian', 'Siamese', 'British Shorthair', 'American Shorthair', 'Domestic Cat'],
                'Large' => ['Maine Coon', 'Ragdoll', 'Norwegian Forest Cat', 'Savannah Cat'],
            ],
            'Rabbit' => [
                'Small' => ['Netherland Dwarf', 'Polish Rabbit', 'Mini Satin'],
                'Medium' => ['Holland Lop', 'Mini Rex', 'Lionhead'],
                'Large' => ['Flemish Giant', 'Continental Giant', 'Checkered Giant'],
            ],
            'Hamster' => [
                'Small' => ['Roborovski Hamster', 'Chinese Hamster'],
                'Medium' => ['Syrian Hamster', 'Golden Hamster'],
            ],
            'Guinea Pig' => [
                'Small' => ['American Guinea Pig', 'Abyssinian'],
                'Medium' => ['Peruvian', 'Silkie', 'Teddy Guinea Pig'],
                'Large' => ['Coronet', 'Texel'],
            ],
            'Bird' => [
                'Small' => ['Budgie', 'Lovebird', 'Finch', 'Canary'],
                'Medium' => ['Cockatiel', 'Quaker Parrot', 'Conure'],
                'Large' => ['African Grey Parrot', 'Macaw', 'Cockatoo'],
            ],
        ];

        foreach ($data as $speciesName => $sizes) {
            $species = Species::where('name', $speciesName)->where('clinic_id', $clinic->id)->first();
            if (!$species) continue;

            foreach ($sizes as $sizeName => $breeds) {
                $sizeId = $sizeMap[$sizeName] ?? null;
                
                foreach ($breeds as $breedName) {
                    Breed::updateOrCreate(
                        [
                            'species_id' => $species->id,
                            'name' => $breedName,
                            'clinic_id' => $clinic->id
                        ],
                        [
                            'default_size_category_id' => $sizeId,
                            'status' => 'Active',
                            'clinic_id' => $clinic->id
                        ]
                    );
                }
            }
        }
    }
}

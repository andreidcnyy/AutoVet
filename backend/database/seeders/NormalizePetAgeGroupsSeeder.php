<?php
// backend/database/seeders/NormalizePetAgeGroupsSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class NormalizePetAgeGroupsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $countPuppy = DB::table('pets')
            ->where('age_group', 'Puppy/Kitten')
            ->update(['age_group' => 'Baby']);

        $countJunior = DB::table('pets')
            ->where('age_group', 'Junior')
            ->update(['age_group' => 'Young']);

        echo "Normalized {$countPuppy} 'Puppy/Kitten' records to 'Baby'.\n";
        echo "Normalized {$countJunior} 'Junior' records to 'Young'.\n";
    }
}

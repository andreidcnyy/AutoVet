<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add species_id to weight_ranges table
        if (!Schema::hasColumn('weight_ranges', 'species_id')) {
            Schema::table('weight_ranges', function (Blueprint $table) {
                $table->foreignId('species_id')->nullable()->after('label')->constrained('species')->onDelete('cascade');
            });
        }

        // 2. Ensure baseline species and size categories exist
        $speciesNames = ['Canine', 'Feline', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];
        $speciesMap = [];
        foreach ($speciesNames as $name) {
            $id = DB::table('species')->where('name', $name)->value('id');
            if (!$id) {
                $id = DB::table('species')->insertGetId([
                    'name' => $name,
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            $speciesMap[$name] = $id;
        }

        $sizeNames = ['Extra Small', 'Small', 'Medium', 'Large', 'Giant'];
        $sizeMap = [];
        foreach ($sizeNames as $name) {
            $id = DB::table('pet_size_categories')->where('name', $name)->value('id');
            if (!$id) {
                $id = DB::table('pet_size_categories')->insertGetId([
                    'name' => $name,
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            $sizeMap[$name] = $id;
        }

        // 3. Migrate existing generic rows to Canine
        $canineId = $speciesMap['Canine'];
        DB::table('weight_ranges')->whereNull('species_id')->update(['species_id' => $canineId]);

        // 4. Seed baseline starter ranges for other species
        $this->seedBaselineRanges($speciesMap, $sizeMap);
    }

    private function seedBaselineRanges($speciesMap, $sizeMap)
    {
        $ranges = [
            'Canine' => [
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.00, 'max' => 10.00],
                ['label' => 'Medium', 'size' => 'Medium', 'min' => 10.01, 'max' => 25.00],
                ['label' => 'Large', 'size' => 'Large', 'min' => 25.01, 'max' => 45.00],
                ['label' => 'Giant', 'size' => 'Giant', 'min' => 45.01, 'max' => null],
            ],
            'Feline' => [
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.00, 'max' => 4.00],
                ['label' => 'Medium', 'size' => 'Medium', 'min' => 4.01, 'max' => 6.00],
                ['label' => 'Large', 'size' => 'Large', 'min' => 6.01, 'max' => 10.00],
            ],
            'Rabbit' => [
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.00, 'max' => 2.00],
                ['label' => 'Medium', 'size' => 'Medium', 'min' => 2.01, 'max' => 4.00],
                ['label' => 'Large', 'size' => 'Large', 'min' => 4.01, 'max' => 7.00],
            ],
            'Hamster' => [
                ['label' => 'Extra Small', 'size' => 'Extra Small', 'min' => 0.00, 'max' => 0.10],
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.11, 'max' => 0.30],
            ],
            'Guinea Pig' => [
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.00, 'max' => 0.80],
                ['label' => 'Medium', 'size' => 'Medium', 'min' => 0.81, 'max' => 1.50],
            ],
            'Bird' => [
                ['label' => 'Extra Small', 'size' => 'Extra Small', 'min' => 0.00, 'max' => 0.20],
                ['label' => 'Small', 'size' => 'Small', 'min' => 0.21, 'max' => 1.00],
                ['label' => 'Medium', 'size' => 'Medium', 'min' => 1.01, 'max' => 5.00],
            ],
        ];

        foreach ($ranges as $speciesName => $speciesRanges) {
            $speciesId = $speciesMap[$speciesName];
            foreach ($speciesRanges as $range) {
                // Check if already exists
                $exists = DB::table('weight_ranges')
                    ->where('species_id', $speciesId)
                    ->where('label', $range['label'])
                    ->where('unit', 'kg')
                    ->exists();

                if (!$exists) {
                    DB::table('weight_ranges')->insert([
                        'species_id' => $speciesId,
                        'label' => $range['label'],
                        'unit' => 'kg',
                        'size_category_id' => $sizeMap[$range['size']],
                        'min_weight' => $range['min'],
                        'max_weight' => $range['max'],
                        'status' => 'Active',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weight_ranges', function (Blueprint $table) {
            if (Schema::hasColumn('weight_ranges', 'species_id')) {
                $table->dropForeign(['species_id']);
                $table->dropColumn('species_id');
            }
        });
    }
};

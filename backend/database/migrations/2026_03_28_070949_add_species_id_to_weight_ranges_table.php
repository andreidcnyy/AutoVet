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
        Schema::table('weight_ranges', function (Blueprint $table) {
            $table->foreignId('species_id')->nullable()->after('label')->constrained('species')->onDelete('cascade');
        });

        // Ensure "Dog" species exists
        $dogId = DB::table('species')->where('name', 'Dog')->value('id');
        if (!$dogId) {
            $dogId = DB::table('species')->insertGetId([
                'name' => 'Dog',
                'status' => 'Active',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // Update existing weight ranges to Dog
        DB::table('weight_ranges')->whereNull('species_id')->update(['species_id' => $dogId]);

        // Ensure "Extra Small" size category exists if needed
        $xsId = DB::table('pet_size_categories')->where('name', 'Extra Small')->value('id');
        if (!$xsId) {
            $xsId = DB::table('pet_size_categories')->insertGetId([
                'name' => 'Extra Small',
                'status' => 'Active',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        $smallId = DB::table('pet_size_categories')->where('name', 'Small')->value('id');
        $mediumId = DB::table('pet_size_categories')->where('name', 'Medium')->value('id');
        $largeId = DB::table('pet_size_categories')->where('name', 'Large')->value('id');

        $speciesData = [
            'Cat' => [
                ['label' => 'Small', 'min' => 0.00, 'max' => 4.00, 'size_id' => $smallId],
                ['label' => 'Medium', 'min' => 4.01, 'max' => 6.00, 'size_id' => $mediumId],
                ['label' => 'Large', 'min' => 6.01, 'max' => 10.00, 'size_id' => $largeId],
            ],
            'Rabbit' => [
                ['label' => 'Small', 'min' => 0.00, 'max' => 2.00, 'size_id' => $smallId],
                ['label' => 'Medium', 'min' => 2.01, 'max' => 4.00, 'size_id' => $mediumId],
                ['label' => 'Large', 'min' => 4.01, 'max' => 7.00, 'size_id' => $largeId],
            ],
            'Hamster' => [
                ['label' => 'Extra Small', 'min' => 0.00, 'max' => 0.10, 'size_id' => $xsId],
                ['label' => 'Small', 'min' => 0.11, 'max' => 0.30, 'size_id' => $smallId],
            ],
            'Guinea Pig' => [
                ['label' => 'Small', 'min' => 0.00, 'max' => 0.80, 'size_id' => $smallId],
                ['label' => 'Medium', 'min' => 0.81, 'max' => 1.50, 'size_id' => $mediumId],
            ],
            'Bird' => [
                ['label' => 'Extra Small', 'min' => 0.00, 'max' => 0.20, 'size_id' => $xsId],
                ['label' => 'Small', 'min' => 0.21, 'max' => 1.00, 'size_id' => $smallId],
                ['label' => 'Medium', 'min' => 1.01, 'max' => 5.00, 'size_id' => $mediumId],
            ],
        ];

        foreach ($speciesData as $name => $ranges) {
            $sId = DB::table('species')->where('name', $name)->value('id');
            if (!$sId) {
                $sId = DB::table('species')->insertGetId([
                    'name' => $name,
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            foreach ($ranges as $r) {
                DB::table('weight_ranges')->insert([
                    'species_id' => $sId,
                    'label' => $r['label'],
                    'min_weight' => $r['min'],
                    'max_weight' => $r['max'],
                    'unit' => 'kg',
                    'size_category_id' => $r['size_id'],
                    'status' => 'Active',
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('weight_ranges', function (Blueprint $table) {
            $table->dropForeign(['species_id']);
            $table->dropColumn('species_id');
        });
    }
};


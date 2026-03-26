<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            // Rename gender to sex
            $table->renameColumn('gender', 'sex');
            
            // Add age_group
            $table->string('age_group')->nullable()->after('date_of_birth');
        });

        // Data Migration
        $pets = \Illuminate\Support\Facades\DB::table('pets')->get();
        foreach ($pets as $pet) {
            $update = [];
            
            // Move weight_value to weight
            if (isset($pet->weight_value) && !isset($pet->weight)) {
                $update['weight'] = $pet->weight_value;
            }

            // Map size_class to size_category_id
            if (isset($pet->size_class) && !isset($pet->size_category_id)) {
                $sizeCat = \Illuminate\Support\Facades\DB::table('pet_size_categories')
                    ->where('name', $pet->size_class)
                    ->first();
                if ($sizeCat) {
                    $update['size_category_id'] = $sizeCat->id;
                }
            }

            if (!empty($update)) {
                \Illuminate\Support\Facades\DB::table('pets')->where('id', $pet->id)->update($update);
            }
        }

        Schema::table('pets', function (Blueprint $table) {
            // Drop redundant columns
            $table->dropColumn(['weight_value', 'size_class']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pets', function (Blueprint $table) {
            $table->decimal('weight_value', 8, 2)->nullable()->after('sex');
            $table->string('size_class')->nullable()->after('weight_unit');
            $table->dropColumn('age_group');
            $table->renameColumn('sex', 'gender');
        });

        // Reverse data migration
        $pets = \Illuminate\Support\Facades\DB::table('pets')->get();
        foreach ($pets as $pet) {
            $sizeCat = \Illuminate\Support\Facades\DB::table('pet_size_categories')
                ->where('id', $pet->size_category_id)
                ->first();
            
            \Illuminate\Support\Facades\DB::table('pets')->where('id', $pet->id)->update([
                'weight_value' => $pet->weight,
                'size_class' => $sizeCat ? $sizeCat->name : null
            ]);
        }
    }
};

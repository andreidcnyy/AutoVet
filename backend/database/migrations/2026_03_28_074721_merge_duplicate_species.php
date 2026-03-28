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
        $toMerge = [
            'Dog' => 'Canine',
            'Cat' => 'Feline'
        ];

        foreach ($toMerge as $oldName => $newName) {
            $oldId = DB::table('species')->where('name', $oldName)->value('id');
            
            // If the old one doesn't exist, skip it
            if (!$oldId) continue;

            // Ensure the new one exists
            $newId = DB::table('species')->where('name', $newName)->value('id');
            if (!$newId) {
                // If it doesn't exist, just rename the old one
                DB::table('species')->where('id', $oldId)->update([
                    'name' => $newName,
                    'updated_at' => now()
                ]);
                continue;
            }

            // If both exist, move data from old to new and delete old
            if ($oldId != $newId) {
                // Update weight ranges
                DB::table('weight_ranges')->where('species_id', $oldId)->update(['species_id' => $newId]);
                
                // Update pets
                DB::table('pets')->where('species_id', $oldId)->update(['species_id' => $newId]);
                
                // Update breeds
                DB::table('breeds')->where('species_id', $oldId)->update(['species_id' => $newId]);
                
                // Delete old species record
                DB::table('species')->where('id', $oldId)->delete();
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversal is complex because data is merged. 
        // We leave it as is to prevent data loss or corruption.
    }
};

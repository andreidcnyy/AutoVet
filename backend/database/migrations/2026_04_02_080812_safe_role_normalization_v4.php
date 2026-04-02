<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $users = DB::table('users')->get();
        
        $unknown = [];
        $empty = 0;
        
        foreach ($users as $user) {
            $role = $user->role;
            if (empty($role)) {
                $empty++;
                continue;
            }
            
            $upperRole = strtoupper($role);
            if (in_array($upperRole, ['ADMIN', 'VETERINARIAN', 'STAFF'])) {
                DB::table('users')->where('id', $user->id)->update(['role' => strtolower($role)]);
            } else {
                $unknown[] = $role;
            }
        }
        
        if ($empty > 0) {
            Log::info("Safe Role Normalization: Skipped {$empty} users with empty/null roles.");
        }
        
        if (count($unknown) > 0) {
            Log::info("Safe Role Normalization: Skipped " . count($unknown) . " users with unknown roles. Roles: " . implode(', ', array_unique($unknown)));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // One-way migration, original capitalization cannot be reliably restored.
    }
};

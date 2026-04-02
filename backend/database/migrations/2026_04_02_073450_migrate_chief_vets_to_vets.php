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
        DB::table('users')
            ->where('role', 'Chief Veterinarian')
            ->update(['role' => 'Veterinarian']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: Reversing this is ambiguous as we don't know who was previously a Chief Vet,
        // but for a clean migration we will leave it empty as the role is being deprecated.
    }
};

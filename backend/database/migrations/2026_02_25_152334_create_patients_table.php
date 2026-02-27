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
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('species');
            $table->string('breed')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->string('color')->nullable();
            $table->string('weight')->nullable();
            $table->string('status')->default('Healthy');
            $table->string('owner_name');
            $table->string('owner_phone')->nullable();
            $table->string('owner_email')->nullable();
            $table->string('allergies')->nullable();
            $table->string('medication')->nullable();
            $table->text('notes')->nullable();
            $table->string('photo')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};

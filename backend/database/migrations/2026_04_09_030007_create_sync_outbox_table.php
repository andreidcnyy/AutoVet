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
        if (!Schema::hasTable('sync_outbox')) {
            Schema::create('sync_outbox', function (Blueprint $table) {
                $table->id();
                $table->string('entity_type'); // e.g., 'Pet', 'Appointment'
                $table->uuid('entity_uuid'); // UUID of the entity being synced
                $table->unsignedBigInteger('entity_local_id'); // Local ID of the entity
                $table->string('action_type'); // 'created', 'updated', 'deleted'
                $table->json('payload'); // The data to be sent
                $table->string('status')->default('pending'); // 'pending', 'processing', 'synced', 'failed'
                $table->integer('retry_count')->default(0);
                $table->text('error_message')->nullable();
                $table->timestamp('queued_at');
                $table->timestamp('processed_at')->nullable();
                $table->timestamps(); // created_at, updated_at for the outbox entry itself
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_outbox');
    }
};

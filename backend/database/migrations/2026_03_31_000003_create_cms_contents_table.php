<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the cms_contents table — website content management for
 * the future pet-owner portal.
 *
 * Supports content types:
 *   announcement    — Time-sensitive clinic notices
 *   banner          — Hero/promotional banners for the portal homepage
 *   clinic_info     — Rich descriptive blocks (about us, team, hours)
 *   featured_service — Services highlighted on the portal
 *
 * Includes sync fields so content created locally is queued
 * for cloud publishing as part of the standard sync process.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cms_contents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            // Content
            $table->string('type', 50);      // announcement | banner | clinic_info | featured_service
            $table->string('title', 255);
            $table->text('body')->nullable();
            $table->string('image_path', 255)->nullable();

            // Portal visibility
            $table->boolean('is_published')->default(false);
            $table->unsignedSmallInteger('display_order')->default(0);

            // Sync metadata
            $table->string('sync_status', 30)->default('local_only');
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('last_modified_locally_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Efficient portal queries: get all published announcements ordered by display
            $table->index(['type', 'is_published', 'display_order'], 'cms_type_published_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cms_contents');
    }
};

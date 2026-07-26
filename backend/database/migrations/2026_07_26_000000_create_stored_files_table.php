<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Durable image/file storage inside the primary database (TiDB), replacing the
 * external Supabase bucket (which auto-pauses on the free tier). Files are served
 * by the /storage/{path} route in routes/web.php.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stored_files', function (Blueprint $table) {
            $table->id();
            $table->string('path', 255)->unique();
            $table->string('mime', 191)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->binary('contents');
            $table->timestamps();
        });

        // binary() creates a 64 KB BLOB — upgrade to LONGBLOB so full images fit.
        DB::statement('ALTER TABLE stored_files MODIFY contents LONGBLOB');
    }

    public function down(): void
    {
        Schema::dropIfExists('stored_files');
    }
};

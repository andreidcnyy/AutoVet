<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE system_announcements MODIFY COLUMN target ENUM('admin','portal','landing','all') NOT NULL DEFAULT 'admin'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE system_announcements MODIFY COLUMN target ENUM('admin','portal','all') NOT NULL DEFAULT 'admin'");
    }
};

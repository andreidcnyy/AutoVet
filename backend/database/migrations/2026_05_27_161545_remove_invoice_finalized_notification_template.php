<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notification_templates')
            ->where('event_key', 'invoice_finalized')
            ->delete();
    }

    public function down(): void
    {
        // No restore — this template is intentionally removed
    }
};

<?php

use App\Support\AuditLogger;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Audit rows say who acted (name and role kept as they were at the time, and
 * clients as well as staff), which record (a readable label), and which
 * request (rows sharing a request_id are one action).
 *
 * It also removes password hashes and tokens that the old trail copied into
 * old_values / new_values with every account change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('audit_logs', 'actor_type')) {
                $table->string('actor_type', 20)->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('audit_logs', 'actor_name')) {
                $table->string('actor_name')->nullable()->after('actor_type');
            }
            if (! Schema::hasColumn('audit_logs', 'actor_role')) {
                $table->string('actor_role', 50)->nullable()->after('actor_name');
            }
            if (! Schema::hasColumn('audit_logs', 'label')) {
                $table->string('label')->nullable()->after('model_id');
            }
            if (! Schema::hasColumn('audit_logs', 'request_id')) {
                $table->uuid('request_id')->nullable()->after('new_values');
            }
        });

        // Guarded like the columns above: TiDB DDL is not transactional, so a
        // boot that dies halfway leaves the first index behind, and an
        // unguarded re-run would fail on it at every restart.
        Schema::table('audit_logs', function (Blueprint $table) {
            if (! Schema::hasIndex('audit_logs', 'audit_logs_clinic_created_idx')) {
                $table->index(['clinic_id', 'created_at'], 'audit_logs_clinic_created_idx');
            }
            if (! Schema::hasIndex('audit_logs', 'audit_logs_request_idx')) {
                $table->index('request_id', 'audit_logs_request_idx');
            }
        });

        // Deleting a staff account used to delete its whole audit history
        // (ON DELETE CASCADE). The trail outlives the account now; the
        // actor_name snapshot still says who it was.
        try {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->foreign('user_id')->references('id')->on('admins')->nullOnDelete();
            });
        } catch (Throwable $e) {
            Log::warning('audit_logs user_id foreign key not changed: '.$e->getMessage());
        }

        // Fill in who acted on existing staff rows.
        DB::statement("UPDATE audit_logs a JOIN admins u ON u.id = a.user_id
            SET a.actor_type = 'staff', a.actor_name = u.name, a.actor_role = u.role
            WHERE a.actor_type IS NULL");

        // Strip secrets copied into existing rows, in small batches.
        DB::table('audit_logs')
            ->where(fn ($q) => $q->where('old_values', 'like', '%password%')
                ->orWhere('new_values', 'like', '%password%')
                ->orWhere('old_values', 'like', '%_token%')
                ->orWhere('new_values', 'like', '%_token%'))
            ->select('id', 'old_values', 'new_values')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    $old = $row->old_values ? json_decode($row->old_values, true) : null;
                    $new = $row->new_values ? json_decode($row->new_values, true) : null;

                    DB::table('audit_logs')->where('id', $row->id)->update([
                        'old_values' => is_array($old) ? json_encode(AuditLogger::redact($old)) : $row->old_values,
                        'new_values' => is_array($new) ? json_encode(AuditLogger::redact($new)) : $row->new_values,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_clinic_created_idx');
            $table->dropIndex('audit_logs_request_idx');
            $table->dropColumn(['actor_type', 'actor_name', 'actor_role', 'label', 'request_id']);
        });
    }
};

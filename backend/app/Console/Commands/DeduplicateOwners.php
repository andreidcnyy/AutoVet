<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\Owner;
use App\Models\PortalUser;

class DeduplicateOwners extends Command
{
    protected $signature   = 'owners:deduplicate {--dry-run : Show what would be merged without making changes}';
    protected $description = 'Merge duplicate Owner records that share the same email or phone';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN — no changes will be saved.');
        }

        $merged = 0;

        // ── 1. Find groups of owners sharing the same non-null email ──────────
        $emailGroups = DB::table('owners')
            ->whereNull('deleted_at')
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->select('email', DB::raw('COUNT(*) as cnt'))
            ->groupBy('email')
            ->having('cnt', '>', 1)
            ->pluck('email');

        foreach ($emailGroups as $email) {
            $owners = Owner::withoutGlobalScopes()
                ->whereNull('deleted_at')
                ->where('email', $email)
                ->orderByRaw('user_id IS NULL ASC')  // linked ones first
                ->orderBy('created_at')
                ->get();

            if ($owners->count() < 2) continue;

            $keeper = $owners->first();
            $dupes  = $owners->slice(1);

            $this->line("Email: <fg=yellow>{$email}</>");
            $this->line("  Keep : #{$keeper->id} — {$keeper->name} (user_id: " . ($keeper->user_id ?? 'none') . ")");

            foreach ($dupes as $dupe) {
                $this->line("  Merge: #{$dupe->id} — {$dupe->name} (user_id: " . ($dupe->user_id ?? 'none') . ")");

                if (!$dryRun) {
                    DB::transaction(function () use ($keeper, $dupe) {
                        // Re-link pets
                        DB::table('pets')
                            ->where('owner_id', $dupe->id)
                            ->update(['owner_id' => $keeper->id]);

                        // Re-link client notifications
                        DB::table('client_notifications')
                            ->where('owner_id', $dupe->id)
                            ->update(['owner_id' => $keeper->id]);

                        // If the dupe was portal-linked and the keeper isn't, transfer the link
                        if ($dupe->user_id && !$keeper->user_id) {
                            $keeper->update(['user_id' => $dupe->user_id]);
                        }

                        // Fill any blank fields on the keeper from the dupe
                        $fill = [];
                        foreach (['phone', 'address', 'city', 'province', 'zip'] as $field) {
                            if (empty($keeper->$field) && !empty($dupe->$field)) {
                                $fill[$field] = $dupe->$field;
                            }
                        }
                        if ($fill) $keeper->update($fill);

                        $dupe->delete();
                    });
                }

                $merged++;
            }
        }

        // ── 2. Find groups sharing the same phone (among those with no email) ─
        $phoneGroups = DB::table('owners')
            ->whereNull('deleted_at')
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->whereNull('email')
            ->select('phone', DB::raw('COUNT(*) as cnt'))
            ->groupBy('phone')
            ->having('cnt', '>', 1)
            ->pluck('phone');

        foreach ($phoneGroups as $phone) {
            $owners = Owner::withoutGlobalScopes()
                ->whereNull('deleted_at')
                ->where('phone', $phone)
                ->whereNull('email')
                ->orderByRaw('user_id IS NULL ASC')
                ->orderBy('created_at')
                ->get();

            if ($owners->count() < 2) continue;

            $keeper = $owners->first();
            $dupes  = $owners->slice(1);

            $this->line("Phone: <fg=yellow>{$phone}</>");
            $this->line("  Keep : #{$keeper->id} — {$keeper->name}");

            foreach ($dupes as $dupe) {
                $this->line("  Merge: #{$dupe->id} — {$dupe->name}");

                if (!$dryRun) {
                    DB::transaction(function () use ($keeper, $dupe) {
                        DB::table('pets')
                            ->where('owner_id', $dupe->id)
                            ->update(['owner_id' => $keeper->id]);

                        DB::table('client_notifications')
                            ->where('owner_id', $dupe->id)
                            ->update(['owner_id' => $keeper->id]);

                        if ($dupe->user_id && !$keeper->user_id) {
                            $keeper->update(['user_id' => $dupe->user_id]);
                        }

                        $dupe->delete();
                    });
                }

                $merged++;
            }
        }

        if ($merged === 0) {
            $this->info('No duplicate owners found.');
        } else {
            $action = $dryRun ? 'Would merge' : 'Merged';
            $this->info("{$action} {$merged} duplicate owner record(s).");
        }

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupArchivedRecords extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'archive:cleanup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Permanently purges archived database records whose retention period has expired';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $models = [
            \App\Models\Pet::class,
            \App\Models\Owner::class,
            \App\Models\Service::class,
            \App\Models\Inventory::class,
            \App\Models\Admin::class,
            \App\Models\PortalUser::class,
            \App\Models\CmsContent::class,
        ];

        $totalPurged = 0;
        $totalFailed = 0;

        foreach ($models as $modelClass) {
            // Find all trashed items that have an expired restore_until timestamp
            $expiredItems = $modelClass::onlyTrashed()
                ->whereNotNull('restore_until')
                ->where('restore_until', '<', now())
                ->get();

            foreach ($expiredItems as $item) {
                try {
                    $item->forceDelete();
                    $totalPurged++;
                } catch (\Exception $e) {
                    $totalFailed++;
                    // Preventable exception based on relations failed the forceDelete
                    // We just ignore it, meaning it stays archived indefinitely and protected.
                }
            }
        }

        $this->info("Archive cleanup complete. Purged {$totalPurged} expired records. Skipped {$totalFailed} protected records.");
    }
}

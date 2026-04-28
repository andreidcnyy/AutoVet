<?php

namespace App\Console\Commands;

use App\Services\SyncService;
use Illuminate\Console\Command;

class SyncToPortal extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-to-portal';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Pushes pending local changes from the outbox to the central portal.';

    /**
     * Execute the console command.
     */
    public function handle(SyncService $syncService): void
    {
        $this->info('Starting synchronization to portal...');
        
        try {
            $syncService->pushToPortal();
            $this->info('Synchronization check complete.');
        } catch (\Exception $e) {
            $this->error('Synchronization failed: ' . $e->getMessage());
        }
    }
}

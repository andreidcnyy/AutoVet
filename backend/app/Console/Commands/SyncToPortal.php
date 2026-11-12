<?php

namespace App\Console\Commands;

use App\Services\SyncService;
use Illuminate\Console\Command;

/**
 * Runs the clinic <-> cloud sync from the clinic computer.
 *
 *   php artisan app:sync                    send local changes, then fetch cloud changes
 *   php artisan app:sync --status           show what is waiting and how the last run went
 *   php artisan app:sync --start-from-now   first-time setup on a database that is already
 *                                           a copy of the cloud: only fetch changes from now on
 *   php artisan app:sync --skip-queued      first-time setup: don't send changes made before
 *                                           sync was switched on
 */
class SyncToPortal extends Command
{
    protected $signature = 'app:sync
        {--status : Show the sync status and exit}
        {--start-from-now : Only fetch cloud changes made from now on}
        {--skip-queued : Mark changes queued so far as handled instead of sending them}';

    protected $aliases = ['app:sync-to-portal'];

    protected $description = 'Send this clinic computer\'s changes to the cloud and fetch the cloud\'s changes';

    public function handle(SyncService $sync): int
    {
        if ($this->option('status')) {
            $this->line(json_encode($sync->status(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        if ($this->option('skip-queued')) {
            $this->info('Skipped '.$sync->skipQueued().' queued change(s); only new changes will be sent.');
        }

        if ($this->option('start-from-now')) {
            $sync->startPullFromNow();
            $this->info('Will fetch only cloud changes made from now on.');
        }

        $result = $sync->run();

        match ($result['status']) {
            'disabled' => $this->warn($result['message']),
            'offline' => $this->warn('Cloud not reachable. Working offline: '.$result['pending'].' change(s) queued, they will be sent when the connection is back.'),
            'error' => $this->error('Sync problem: '.($result['push']['message'] ?? $result['pull']['message'] ?? 'see the log')),
            default => $this->info(sprintf(
                'Synced. Sent %d change(s) %s; received %d %s; %d still queued.',
                $result['push']['sent'] ?? 0,
                json_encode($result['push']['counts'] ?? []),
                $result['pull']['received'] ?? 0,
                json_encode($result['pull']['counts'] ?? []),
                $result['pending'],
            )),
        };

        if (! empty($result['pull']['errors'])) {
            $this->warn('Some cloud records could not be applied: '.implode(' | ', $result['pull']['errors']));
        }

        return $result['status'] === 'error' ? self::FAILURE : self::SUCCESS;
    }
}

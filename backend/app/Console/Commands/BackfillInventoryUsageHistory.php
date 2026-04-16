<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\InventoryUsageHistory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class BackfillInventoryUsageHistory extends Command
{
    protected $signature = 'app:backfill-inventory-usage-history
                            {--dry-run : Preview what would be inserted without writing to the database}';

    protected $description = 'Backfill inventory_usage_history from historical finalized/paid invoices. Idempotent — safe to run multiple times.';

    // Statuses that represent invoices where stock was actually consumed
    private const FINALIZED_STATUSES = ['Finalized', 'Paid', 'Partially Paid'];

    public function handle(): int
    {
        $dryRun    = $this->option('dry-run');
        $processed = 0;
        $inserted  = 0;
        $skipped   = 0;
        $failed    = 0;

        if ($dryRun) {
            $this->warn('[DRY RUN] No records will be written.');
        }

        $this->info('Fetching finalized invoices with inventory line items...');

        // Load only invoices that had stock deducted, with items that have an inventory_id
        Invoice::whereIn('status', self::FINALIZED_STATUSES)
            ->where('stock_deducted', true)
            ->with(['items' => function ($q) {
                $q->whereNotNull('inventory_id');
            }])
            ->orderBy('id')
            ->chunk(100, function ($invoices) use ($dryRun, &$processed, &$inserted, &$skipped, &$failed) {
                foreach ($invoices as $invoice) {
                    $usageDate = optional($invoice->updated_at)->toDateString()
                        ?? optional($invoice->created_at)->toDateString()
                        ?? now()->toDateString();

                    foreach ($invoice->items as $item) {
                        $processed++;

                        // Skip items with no inventory linkage (safety check)
                        if (!$item->inventory_id) {
                            $skipped++;
                            continue;
                        }

                        // Skip items with no quantity recorded
                        if (!$item->qty || $item->qty <= 0) {
                            $this->line("  [SKIP] Invoice #{$invoice->invoice_number} item #{$item->id}: qty={$item->qty} — skipping zero/null qty.");
                            $skipped++;
                            continue;
                        }

                        try {
                            // Check if already exists (idempotency guard)
                            $alreadyExists = InventoryUsageHistory::where('invoice_item_id', $item->id)->exists();

                            if ($alreadyExists) {
                                $skipped++;
                                continue;
                            }

                            if ($dryRun) {
                                $this->line("  [DRY RUN] Would insert: inventory_id={$item->inventory_id}, invoice_id={$invoice->id}, item_id={$item->id}, qty={$item->qty}, date={$usageDate}");
                                $inserted++;
                                continue;
                            }

                            InventoryUsageHistory::create([
                                'inventory_id'   => $item->inventory_id,
                                'invoice_id'     => $invoice->id,
                                'invoice_item_id' => $item->id,
                                'quantity_used'  => $item->qty,
                                'usage_date'     => $usageDate,
                                'source_type'    => $item->item_type === 'service' ? 'service_consumable' : 'retail_sale',
                                'unit_price'     => $item->unit_price ?? null,
                            ]);

                            $inserted++;

                        } catch (\Throwable $e) {
                            $failed++;
                            $this->error("  [FAIL] Invoice #{$invoice->invoice_number} item #{$item->id}: " . $e->getMessage());
                            Log::error('BackfillInventoryUsageHistory: insert failed', [
                                'invoice_id'     => $invoice->id,
                                'invoice_item_id' => $item->id,
                                'error'          => $e->getMessage(),
                            ]);
                        }
                    }
                }
            });

        $this->newLine();
        $this->info('Backfill complete.');
        $this->table(
            ['Processed', 'Inserted', 'Skipped', 'Failed'],
            [[$processed, $inserted, $skipped, $failed]]
        );

        if ($failed > 0) {
            $this->warn("{$failed} record(s) failed — check laravel.log for details.");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}

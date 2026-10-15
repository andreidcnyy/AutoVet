<?php

namespace App\Console\Commands;

use App\Console\Concerns\LoadsLiveConnection;
use App\Support\ForecastMetrics;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fills gaps in inventory usage history with statistically realistic rows.
 *
 * Nothing is invented from scratch: every parameter is learned from the
 * clinic's own real records in a reference period.
 *
 *   1. Usage rate per item:   λᵢ = Qᵢ / D
 *      Qᵢ = units of item i used in the reference period, D = days covered.
 *      An item never used there takes the median λ of its category.
 *   2. Weekday pattern:       w_d = (appointments on weekday d) / (average per weekday)
 *   3. Growth:                g = b / ȳ, where b is the least-squares slope of
 *      the monthly usage totals and ȳ their mean (clamped to ±3% a month).
 *   4. Expected use on day t: λᵢ,t = λᵢ · w_weekday(t) · (1 + g)^(months from the reference midpoint)
 *   5. Actual use on day t:   Xᵢ,t ~ Poisson(λᵢ,t)  — the standard model for
 *      counts of independent events per day. A day with Xᵢ,t = 0 gets no row.
 *
 * Only "gap weeks" are filled: weeks in the window whose real total is below
 * --gap-threshold (default 50%) of the expected total. Inside them, a row is
 * written only for an item-day with no record at all, so real data is never
 * overwritten or duplicated. Every generated row carries --batch in
 * synthetic_batch, so it can be reported separately or removed (--purge).
 * The random generator is seeded, so the same inputs give the same rows.
 */
class SeedInventoryUsage extends Command
{
    use LoadsLiveConnection;

    protected $signature = 'inventory:seed-usage
        {--live : Write to the production database (backend/.env.live) instead of the local one}
        {--from=2026-06-01 : First day that may be filled}
        {--to= : Last day that may be filled (default: yesterday)}
        {--ref-from=2025-06-01 : Start of the reference period the parameters are learned from}
        {--ref-to=2026-05-31 : End of the reference period}
        {--seed=20261015 : Random seed (same seed = same rows)}
        {--batch=synthetic-2026-10 : Label stored on every generated row}
        {--gap-threshold=0.5 : Fill a week when its real total is below this share of the expected total}
        {--dry-run : Calculate and report, but write nothing}
        {--purge : Delete the rows of --batch instead of generating}
        {--report= : Write the parameters and results as JSON to this path}';

    protected $description = 'Fill gaps in inventory usage history with Poisson-distributed usage learned from real records';

    private const SAFE_SOURCES = ['retail_sale', 'service_consumable', 'manual_adjustment'];

    /** Categories whose items are used up during treatment rather than sold over the counter. */
    private const CONSUMED_IN_SERVICE = ['consumables', 'vaccines'];

    private int $randState;

    public function handle(): int
    {
        $connection = 'mysql';
        if ($this->option('live')) {
            if (!$this->loadLiveEnv()) {
                $this->explainMissingLiveConfig();
                return self::FAILURE;
            }
            $connection = 'live';
        }
        $db = DB::connection($connection);

        if (!Schema::connection($connection)->hasColumn('inventory_usage_history', 'synthetic_batch')) {
            $this->error('inventory_usage_history.synthetic_batch is missing. Run the migrations on this database first.');
            return self::FAILURE;
        }

        $batch = (string) $this->option('batch');

        if ($this->option('purge')) {
            $deleted = $this->option('dry-run')
                ? $db->table('inventory_usage_history')->where('synthetic_batch', $batch)->count()
                : $db->table('inventory_usage_history')->where('synthetic_batch', $batch)->delete();
            $this->info(($this->option('dry-run') ? 'Would delete ' : 'Deleted ') . "{$deleted} row(s) of batch {$batch} on [{$connection}].");
            return self::SUCCESS;
        }

        $from = CarbonImmutable::parse($this->option('from'))->startOfDay();
        $to = $this->option('to')
            ? CarbonImmutable::parse($this->option('to'))->startOfDay()
            : CarbonImmutable::yesterday();
        $refFrom = CarbonImmutable::parse($this->option('ref-from'))->startOfDay();
        $refTo = CarbonImmutable::parse($this->option('ref-to'))->startOfDay();

        if ($to->lt($from) || $refTo->lt($refFrom)) {
            $this->error('Each period must end on or after its start.');
            return self::FAILURE;
        }

        $this->randState = (int) $this->option('seed');

        // ---------------------------------------------------------------- items
        // One forecast subject per product code: extra stock batches of the
        // same product share its code and its usage.
        $items = collect($db->table('inventories as i')
            ->leftJoin('mdm_inventory_categories as c', 'c.id', '=', 'i.inventory_category_id')
            ->whereNull('i.deleted_at')
            ->whereNotNull('i.code')->where('i.code', '!=', '')
            ->orderBy('i.id')
            ->get(['i.id', 'i.clinic_id', 'i.code', 'i.item_name', 'i.selling_price', 'c.name as category']))
            ->unique('code')
            ->values();

        if ($items->isEmpty()) {
            $this->error('No inventory items with a code were found.');
            return self::FAILURE;
        }

        $real = fn () => $db->table('inventory_usage_history')
            ->whereNull('synthetic_batch')
            ->whereIn('source_type', self::SAFE_SOURCES);

        // ----------------------------------------------------- reference period
        // The period actually covered by data: a database whose history starts
        // after --ref-from is measured from its first record, not from a span
        // in which nothing could have been recorded.
        $firstRecord = $real()->min('usage_date');
        $coverageFrom = $firstRecord ? CarbonImmutable::parse($firstRecord)->max($refFrom) : $refFrom;
        $days = max(1, $coverageFrom->diffInDays($refTo) + 1);

        $refTotals = $real()
            ->whereBetween('usage_date', [$coverageFrom->toDateString(), $refTo->toDateString()])
            ->groupBy('inventory_id')
            ->selectRaw('inventory_id, SUM(quantity_used) AS total')
            ->pluck('total', 'inventory_id');

        // λᵢ = Qᵢ / D
        $rates = [];
        foreach ($items as $item) {
            $q = (float) ($refTotals[$item->id] ?? 0);
            $rates[$item->id] = ['lambda' => $q / $days, 'quantity' => $q, 'source' => 'own history'];
        }

        // Items never used in the reference period: median λ of their category.
        $byCategory = [];
        foreach ($items as $item) {
            if ($rates[$item->id]['quantity'] > 0) {
                $byCategory[$item->category ?? '-'][] = $rates[$item->id]['lambda'];
            }
        }
        $allObserved = array_merge(...array_values($byCategory ?: [[0.0]]));
        foreach ($items as $item) {
            if ($rates[$item->id]['quantity'] > 0) {
                continue;
            }
            $pool = $byCategory[$item->category ?? '-'] ?? $allObserved;
            $rates[$item->id]['lambda'] = self::median($pool);
            $rates[$item->id]['source'] = isset($byCategory[$item->category ?? '-'])
                ? 'median of category'
                : 'median of all items';
        }

        // ------------------------------------------------------ weekday weights
        // w_d = appointments on weekday d / average appointments per weekday
        $byWeekday = $db->table('appointments')
            ->whereNull('deleted_at')
            ->whereBetween('date', [$coverageFrom->toDateString(), $refTo->toDateString()])
            ->groupBy(DB::raw('DAYOFWEEK(date)'))
            ->selectRaw('DAYOFWEEK(date) AS dow, COUNT(*) AS n')
            ->pluck('n', 'dow')
            ->map(fn ($v) => (int) $v);
        $weights = [];
        $avgPerWeekday = $byWeekday->count() === 7 ? $byWeekday->avg() : null;
        foreach (range(1, 7) as $mysqlDow) {
            $weights[$mysqlDow] = $avgPerWeekday ? ((float) $byWeekday[$mysqlDow]) / $avgPerWeekday : 1.0;
        }

        // ---------------------------------------------------------------- growth
        // g = b / ȳ from the least-squares line through the full months' totals.
        $monthly = $real()
            ->whereBetween('usage_date', [$coverageFrom->toDateString(), $refTo->toDateString()])
            ->selectRaw("DATE_FORMAT(usage_date, '%Y-%m') AS ym, SUM(quantity_used) AS total")
            ->groupBy('ym')
            ->orderBy('ym')
            ->pluck('total', 'ym')
            ->map(fn ($v) => (float) $v);
        // Full months only: a partial first or last month would look like a dip.
        $monthly = $monthly->filter(function ($total, $ym) use ($coverageFrom, $refTo) {
            $start = CarbonImmutable::parse($ym . '-01');
            return $start->gte($coverageFrom) && $start->endOfMonth()->startOfDay()->lte($refTo);
        });
        $growth = 0.0;
        if ($monthly->count() >= 3) {
            [$slope] = ForecastMetrics::fitLine(range(0, $monthly->count() - 1), $monthly->values()->all());
            $mean = $monthly->avg();
            $growth = $mean > 0 ? max(-0.03, min(0.03, $slope / $mean)) : 0.0;
        }
        $midpoint = $coverageFrom->addDays(intdiv($days, 2));

        $expectedOn = function (int $itemId, CarbonImmutable $day) use ($rates, $weights, $growth, $midpoint): float {
            $months = $midpoint->diffInDays($day, false) / 30.4375;
            return $rates[$itemId]['lambda'] * $weights[$day->dayOfWeekIso % 7 + 1] * (1 + $growth) ** $months;
        };

        // ------------------------------------------------------------ gap weeks
        $itemIds = $items->pluck('id')->all();
        $existing = $db->table('inventory_usage_history')
            ->whereIn('inventory_id', $itemIds)
            ->whereBetween('usage_date', [$from->toDateString(), $to->toDateString()])
            ->get(['inventory_id', 'usage_date', 'quantity_used', 'synthetic_batch', 'source_type']);

        $hasRow = [];
        $realByDay = [];
        foreach ($existing as $row) {
            $date = substr((string) $row->usage_date, 0, 10);
            $hasRow[$row->inventory_id][$date] = true;
            if ($row->synthetic_batch === null && in_array($row->source_type, self::SAFE_SOURCES, true)) {
                $realByDay[$date] = ($realByDay[$date] ?? 0) + (float) $row->quantity_used;
            }
        }

        $weeks = [];
        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            $key = $day->startOfWeek()->toDateString();
            $weeks[$key]['days'][] = $day;
            $weeks[$key]['real'] = ($weeks[$key]['real'] ?? 0) + ($realByDay[$day->toDateString()] ?? 0);
            $expectedDay = 0.0;
            foreach ($itemIds as $id) {
                $expectedDay += $expectedOn($id, $day);
            }
            $weeks[$key]['expected'] = ($weeks[$key]['expected'] ?? 0) + $expectedDay;
        }
        $threshold = (float) $this->option('gap-threshold');
        foreach ($weeks as $key => $week) {
            $weeks[$key]['gap'] = $week['real'] < $threshold * $week['expected'];
        }

        // ------------------------------------------------------------- generate
        $rows = [];
        $perItem = [];
        foreach ($items as $item) {
            $consumedInService = in_array(strtolower((string) $item->category), self::CONSUMED_IN_SERVICE, true);
            foreach ($weeks as $week) {
                foreach ($week['days'] as $day) {
                    // Draw for every day so the sequence does not depend on which
                    // days are skipped; then keep only gap-week days with no record.
                    $qty = ForecastMetrics::poisson($expectedOn($item->id, $day), fn () => $this->uniform());
                    if (!$week['gap'] || isset($hasRow[$item->id][$day->toDateString()])) {
                        continue;
                    }
                    $perItem[$item->id]['days'] = ($perItem[$item->id]['days'] ?? 0) + 1;
                    $perItem[$item->id]['sum'] = ($perItem[$item->id]['sum'] ?? 0) + $qty;
                    $perItem[$item->id]['sumsq'] = ($perItem[$item->id]['sumsq'] ?? 0) + $qty * $qty;
                    if ($qty <= 0) {
                        continue;
                    }
                    $stamp = $day->setTime(17, 0)->toDateTimeString();
                    $rows[] = [
                        'clinic_id'       => $item->clinic_id,
                        'inventory_id'    => $item->id,
                        'invoice_id'      => null,
                        'invoice_item_id' => null,
                        'quantity_used'   => $qty,
                        'usage_date'      => $day->toDateString(),
                        'source_type'     => $consumedInService ? 'service_consumable' : 'retail_sale',
                        'unit_price'      => ((float) $item->selling_price) > 0 ? $item->selling_price : null,
                        'synthetic_batch' => $batch,
                        'created_at'      => $stamp,
                        'updated_at'      => $stamp,
                    ];
                }
            }
        }

        // --------------------------------------------------------------- report
        $gapWeeks = array_keys(array_filter($weeks, fn ($w) => $w['gap']));
        $this->line("Database: [{$connection}]  Reference: {$coverageFrom->toDateString()} to {$refTo->toDateString()} ({$days} days)");
        $this->line(sprintf('Monthly growth g = %+.2f%%  |  weekday weights (Sun..Sat): %s', $growth * 100,
            implode(' ', array_map(fn ($w) => number_format($w, 3), $weights))));
        $this->line(sprintf('Gap weeks filled: %d of %d  |  rows to write: %d  |  units: %d',
            count($gapWeeks), count($weeks), count($rows), array_sum(array_column($rows, 'quantity_used'))));

        $report = [
            'database'        => $connection,
            'batch'           => $batch,
            'seed'            => (int) $this->option('seed'),
            'window'          => [$from->toDateString(), $to->toDateString()],
            'reference'       => [$coverageFrom->toDateString(), $refTo->toDateString(), $days],
            'growth_monthly'  => $growth,
            'monthly_totals'  => $monthly->all(),
            'weekday_weights' => ['sun' => $weights[1], 'mon' => $weights[2], 'tue' => $weights[3], 'wed' => $weights[4],
                                  'thu' => $weights[5], 'fri' => $weights[6], 'sat' => $weights[7]],
            'appointments_by_weekday' => $byWeekday->all(),
            'gap_threshold'   => $threshold,
            'weeks'           => array_map(fn ($k, $w) => ['week_of' => $k, 'real' => $w['real'], 'expected' => round($w['expected'], 2), 'filled' => $w['gap']],
                                    array_keys($weeks), $weeks),
            'items'           => $items->map(function ($item) use ($rates, $perItem) {
                $s = $perItem[$item->id] ?? ['days' => 0, 'sum' => 0, 'sumsq' => 0];
                $mean = $s['days'] ? $s['sum'] / $s['days'] : 0;
                $var = $s['days'] ? $s['sumsq'] / $s['days'] - $mean ** 2 : 0;
                return [
                    'id' => $item->id, 'code' => $item->code, 'name' => $item->item_name, 'category' => $item->category,
                    'reference_quantity' => $rates[$item->id]['quantity'],
                    'lambda' => $rates[$item->id]['lambda'], 'lambda_source' => $rates[$item->id]['source'],
                    'generated_days' => $s['days'], 'generated_units' => $s['sum'],
                    'generated_mean_per_day' => $mean, 'generated_variance' => $var,
                ];
            })->values()->all(),
            'rows_written'    => $this->option('dry-run') ? 0 : count($rows),
            'rows_planned'    => count($rows),
        ];

        if ($path = $this->option('report')) {
            file_put_contents($path, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->line("Report written to {$path}");
        }

        if ($this->option('dry-run')) {
            $this->warn('Dry run: nothing written.');
            return self::SUCCESS;
        }

        $db->transaction(function () use ($db, $rows) {
            foreach (array_chunk($rows, 500) as $chunk) {
                $db->table('inventory_usage_history')->insert($chunk);
            }
        });
        $this->info('Written ' . count($rows) . " row(s) labelled {$batch}.");

        return self::SUCCESS;
    }

    /** Deterministic uniform number in (0, 1) — a 32-bit LCG, so the same seed gives the same rows on any machine. */
    private function uniform(): float
    {
        $this->randState = (1664525 * $this->randState + 1013904223) % 4294967296;
        return ($this->randState + 1) / 4294967297;
    }

    private static function median(array $values): float
    {
        if (!$values) {
            return 0.0;
        }
        sort($values);
        $n = count($values);
        return $n % 2 ? $values[intdiv($n, 2)] : ($values[$n / 2 - 1] + $values[$n / 2]) / 2;
    }
}

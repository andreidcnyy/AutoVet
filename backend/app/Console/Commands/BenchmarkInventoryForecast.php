<?php

namespace App\Console\Commands;

use App\Console\Concerns\LoadsLiveConnection;
use App\Support\ForecastMetrics;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Scores the inventory forecast on every item, the way the forecast itself
 * does it (ai/batch_forecast.py):
 *
 *   - usage per day over the last --history-days days, then the running total
 *     (cumulative consumption) against the day number;
 *   - a straight line fitted to the oldest 80% of those days, scored on the
 *     newest 20% with R², RMSE and MAE (fewer than 10 days: scored in-sample);
 *   - the line's slope is the learned "units used per day".
 *
 * Also reports, per item:
 *   - the "guess the average" baseline on the same test days, which is what
 *     R² = 0 means, so the model can be compared against doing nothing clever;
 *   - a rate check: the daily rate learned from the 80% against the rate
 *     actually seen in the 20%, as a percentage error. (Running totals always
 *     look straight, which flatters R²; this check does not.)
 *
 * --real-only ignores generated rows, so the same command measures the data
 * before and after seeding.
 */
class BenchmarkInventoryForecast extends Command
{
    use LoadsLiveConnection;

    protected $signature = 'inventory:forecast-benchmark
        {--live : Read the production database (backend/.env.live)}
        {--history-days=365 : Days of history to score, as the dashboard forecast uses}
        {--as-of= : Last day of the window (default: yesterday)}
        {--real-only : Ignore generated (synthetic) rows}
        {--json= : Write the per-item results as JSON to this path}';

    protected $description = 'Score the inventory forecast (R², RMSE, MAE, 80/20 holdout) for every item';

    private const SAFE_SOURCES = ['retail_sale', 'service_consumable', 'manual_adjustment'];

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

        $asOf = $this->option('as-of') ? CarbonImmutable::parse($this->option('as-of')) : CarbonImmutable::yesterday();
        $from = $asOf->subDays((int) $this->option('history-days'));

        $items = collect($db->table('inventories as i')
            ->leftJoin('mdm_inventory_categories as c', 'c.id', '=', 'i.inventory_category_id')
            ->whereNull('i.deleted_at')->whereNotNull('i.code')->where('i.code', '!=', '')
            ->orderBy('i.id')
            ->get(['i.id', 'i.code', 'i.item_name', 'c.name as category', 'i.stock_level', 'i.min_stock_level']))
            ->unique('code')->values();

        $usage = $db->table('inventory_usage_history')
            ->whereIn('source_type', self::SAFE_SOURCES)
            ->whereBetween('usage_date', [$from->toDateString(), $asOf->toDateString()])
            ->when($this->option('real-only') && Schema::connection($connection)->hasColumn('inventory_usage_history', 'synthetic_batch'),
                fn ($q) => $q->whereNull('synthetic_batch'))
            ->selectRaw('inventory_id, usage_date, SUM(quantity_used) AS qty')
            ->groupBy('inventory_id', 'usage_date')
            ->orderBy('usage_date')
            ->get()
            ->groupBy('inventory_id');

        $results = [];
        foreach ($items as $item) {
            $days = $usage[$item->id] ?? collect();
            $result = [
                'id' => $item->id, 'code' => $item->code, 'name' => $item->item_name, 'category' => $item->category,
                'data_points' => $days->count(), 'units' => (float) $days->sum('qty'),
            ];

            if ($days->count() < 3) {
                $results[] = $result + ['status' => 'Insufficient Data'];
                continue;
            }

            $first = CarbonImmutable::parse($days->first()->usage_date);
            $x = [];
            $y = [];
            $running = 0.0;
            foreach ($days as $d) {
                $running += (float) $d->qty;
                $x[] = (float) $first->diffInDays(CarbonImmutable::parse($d->usage_date));
                $y[] = $running;
            }

            $h = ForecastMetrics::holdout($x, $y);
            [$slopeAll] = ForecastMetrics::fitLine($x, $y);

            // Rate check: learned rate (training slope) vs rate seen in the test days.
            $rateError = null;
            $observedRate = null;
            if ($h['split_index']) {
                $s = $h['split_index'];
                $span = $x[count($x) - 1] - $x[$s - 1];
                if ($span > 0) {
                    $observedRate = ($y[count($y) - 1] - $y[$s - 1]) / $span;
                    $rateError = $observedRate > 0 ? abs($h['slope'] - $observedRate) / $observedRate : null;
                }
            }

            $results[] = $result + [
                'status'          => 'Scored',
                'method'          => $h['method'],
                'train_points'    => $h['train_points'],
                'test_points'     => $h['test_points'],
                'train_r2'        => $h['train_r2'],
                'test_r2'         => $h['test_r2'],
                'rmse'            => $h['rmse'],
                'mae'             => $h['mae'],
                'baseline_rmse'   => $h['baseline_rmse'],
                'baseline_mae'    => $h['baseline_mae'],
                'anchored_r2'     => $h['anchored_r2'] ?? null,
                'anchored_rmse'   => $h['anchored_rmse'] ?? null,
                'anchored_mae'    => $h['anchored_mae'] ?? null,
                'confidence'      => ForecastMetrics::confidenceLabel($h['train_r2']),
                'learned_rate'    => $slopeAll,
                'train_rate'      => $h['slope'],
                'observed_test_rate' => $observedRate,
                'rate_error'      => $rateError,
                'stock'           => (float) $item->stock_level,
                'min_stock'       => (float) $item->min_stock_level,
                'days_to_min'     => $slopeAll > 0 ? (int) ceil(max(0, $item->stock_level - $item->min_stock_level) / $slopeAll) : null,
            ];
        }

        $scored = array_values(array_filter($results, fn ($r) => $r['status'] === 'Scored'));
        $holdout = array_values(array_filter($scored, fn ($r) => $r['test_r2'] !== null));
        $median = function (array $values) {
            $values = array_values(array_filter($values, fn ($v) => $v !== null));
            if (!$values) return null;
            sort($values);
            $n = count($values);
            return $n % 2 ? $values[intdiv($n, 2)] : ($values[$n / 2 - 1] + $values[$n / 2]) / 2;
        };

        $summary = [
            'database'          => $connection,
            'window'            => [$from->toDateString(), $asOf->toDateString()],
            'real_only'         => (bool) $this->option('real-only'),
            'items'             => count($results),
            'scored'            => count($scored),
            'insufficient_data' => count($results) - count($scored),
            'with_80_20_holdout'=> count($holdout),
            'confidence'        => array_count_values(array_column($scored, 'confidence')) + ['High' => 0, 'Medium' => 0, 'Low' => 0],
            'median_train_r2'   => $median(array_column($scored, 'train_r2')),
            'median_test_r2'    => $median(array_column($holdout, 'test_r2')),
            'median_rmse'       => $median(array_column($holdout, 'rmse')),
            'median_mae'        => $median(array_column($holdout, 'mae')),
            'median_baseline_mae' => $median(array_column($holdout, 'baseline_mae')),
            'median_baseline_rmse' => $median(array_column($holdout, 'baseline_rmse')),
            'median_anchored_r2'  => $median(array_column($holdout, 'anchored_r2')),
            'median_anchored_mae' => $median(array_column($holdout, 'anchored_mae')),
            'median_anchored_rmse' => $median(array_column($holdout, 'anchored_rmse')),
            'median_rate_error' => $median(array_column($holdout, 'rate_error')),
            'median_data_points'=> $median(array_column($results, 'data_points')),
        ];

        $this->line("Database: [{$connection}]  Window: {$summary['window'][0]} to {$summary['window'][1]}"
            . ($summary['real_only'] ? '  (real rows only)' : ''));
        $this->table(['Items', 'Scored', 'Insufficient', '80/20', 'High', 'Medium', 'Low', 'Med. R²', 'Med. test R²', 'Med. MAE', 'Med. rate error'], [[
            $summary['items'], $summary['scored'], $summary['insufficient_data'], $summary['with_80_20_holdout'],
            $summary['confidence']['High'], $summary['confidence']['Medium'], $summary['confidence']['Low'],
            self::fmt($summary['median_train_r2']), self::fmt($summary['median_test_r2']),
            self::fmt($summary['median_mae']), $summary['median_rate_error'] !== null ? number_format($summary['median_rate_error'] * 100, 1) . '%' : '-',
        ]]);

        if ($path = $this->option('json')) {
            file_put_contents($path, json_encode(['summary' => $summary, 'items' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->line("Results written to {$path}");
        }

        return self::SUCCESS;
    }

    private static function fmt($v): string
    {
        return $v === null ? '-' : number_format((float) $v, 4);
    }
}

<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SeedInventoryUsageTest extends TestCase
{
    use RefreshDatabase;

    private int $itemA;
    private int $itemB;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Clinic', 'email' => 'c@example.com', 'status' => 'active']);
        $cat = DB::table('mdm_inventory_categories')->insertGetId(['clinic_id' => 1, 'name' => 'Consumables', 'status' => 'Active']);

        $make = fn (string $code, string $name) => DB::table('inventories')->insertGetId([
            'clinic_id' => 1, 'item_name' => $name, 'code' => $code, 'sku' => $code,
            'inventory_category_id' => $cat, 'stock_level' => 100, 'min_stock_level' => 10,
            'status' => 'Active', 'price' => 10, 'selling_price' => 20,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->itemA = $make('A-1', 'Syringe');
        $this->itemB = $make('B-1', 'Gauze'); // never used: takes the category median

        // Reference period: item A used 2 units every day of January–March.
        for ($d = CarbonImmutable::parse('2026-01-01'); $d->lte(CarbonImmutable::parse('2026-03-31')); $d = $d->addDay()) {
            DB::table('inventory_usage_history')->insert([
                'clinic_id' => 1, 'inventory_id' => $this->itemA, 'quantity_used' => 2,
                'usage_date' => $d->toDateString(), 'source_type' => 'retail_sale',
            ]);
        }

        // Window: real data for the first week of May, nothing after it.
        for ($d = CarbonImmutable::parse('2026-05-04'); $d->lte(CarbonImmutable::parse('2026-05-10')); $d = $d->addDay()) {
            DB::table('inventory_usage_history')->insert([
                'clinic_id' => 1, 'inventory_id' => $this->itemA, 'quantity_used' => 2,
                'usage_date' => $d->toDateString(), 'source_type' => 'retail_sale',
            ]);
        }
    }

    private function runSeeder(array $extra = []): void
    {
        $this->artisan('inventory:seed-usage', array_merge([
            '--from' => '2026-05-04', '--to' => '2026-05-31',
            '--ref-from' => '2026-01-01', '--ref-to' => '2026-03-31',
            '--seed' => 42, '--batch' => 'test-batch',
        ], $extra))->assertSuccessful();
    }

    public function test_only_gap_weeks_are_filled_and_real_rows_are_untouched(): void
    {
        $realBefore = DB::table('inventory_usage_history')->whereNull('synthetic_batch')->count();

        $this->runSeeder();

        $synthetic = DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch');
        $this->assertGreaterThan(0, $synthetic->count());
        $this->assertSame($realBefore, DB::table('inventory_usage_history')->whereNull('synthetic_batch')->count());

        // The first week had real data: nothing generated inside it.
        $this->assertSame(0, (clone $synthetic)->whereBetween('usage_date', ['2026-05-04', '2026-05-10'])->count());

        // Never two rows for the same item and day.
        $dupes = DB::table('inventory_usage_history')
            ->select('inventory_id', 'usage_date')->groupBy('inventory_id', 'usage_date')
            ->havingRaw('COUNT(*) > 1')->count();
        $this->assertSame(0, $dupes);
    }

    public function test_generated_usage_follows_the_learned_rate(): void
    {
        $this->runSeeder();

        // Item A used 2 a day in the reference period; 21 filled days should
        // come out close to 42 units (Poisson spread allows some room).
        $units = (float) DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')
            ->where('inventory_id', $this->itemA)->sum('quantity_used');
        $this->assertEqualsWithDelta(42, $units, 18);

        // Item B has no history of its own; it borrows the category median (A's rate).
        $this->assertGreaterThan(0, DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')
            ->where('inventory_id', $this->itemB)->count());
    }

    public function test_the_same_seed_gives_the_same_rows_and_purge_removes_them(): void
    {
        $this->runSeeder();
        $first = DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')
            ->orderBy('inventory_id')->orderBy('usage_date')->get(['inventory_id', 'usage_date', 'quantity_used'])->toArray();

        $this->runSeeder(['--purge' => true]);
        $this->assertSame(0, DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')->count());

        $this->runSeeder();
        $second = DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')
            ->orderBy('inventory_id')->orderBy('usage_date')->get(['inventory_id', 'usage_date', 'quantity_used'])->toArray();

        $this->assertEquals($first, $second);
    }

    public function test_dry_run_writes_nothing_and_benchmark_runs(): void
    {
        $this->runSeeder(['--dry-run' => true]);
        $this->assertSame(0, DB::table('inventory_usage_history')->where('synthetic_batch', 'test-batch')->count());

        $this->runSeeder();
        $this->artisan('inventory:forecast-benchmark', ['--as-of' => '2026-05-31', '--history-days' => 365])->assertSuccessful();
    }
}

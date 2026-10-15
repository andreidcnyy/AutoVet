<?php

namespace Tests\Unit;

use App\Support\ForecastMetrics;
use PHPUnit\Framework\TestCase;

class ForecastMetricsTest extends TestCase
{
    /**
     * The worked example in "How AutoVet Measures Forecast Accuracy":
     * 16 weeks of appointments, the oldest 12 to learn, the newest 4 to test.
     */
    public function test_reproduces_the_worked_example_from_the_accuracy_guide(): void
    {
        $y = [18, 21, 20, 24, 23, 26, 25, 29, 28, 31, 30, 34, 33, 35, 37, 38];
        $x = range(0, 15);

        $h = ForecastMetrics::holdout($x, $y);

        $this->assertSame('80/20 holdout', $h['method']);
        $this->assertSame(12, $h['train_points']);
        $this->assertEqualsWithDelta(1.30, $h['slope'], 0.005);
        $this->assertEqualsWithDelta(18.62, $h['intercept'], 0.005);
        $this->assertEqualsWithDelta(0.89, $h['test_r2'], 0.005);
        $this->assertEqualsWithDelta(0.49, $h['mae'], 0.005);
        $this->assertEqualsWithDelta(0.65, $h['rmse'], 0.005);
        // "Guess the average every week": MAE 1.75, RMSE 1.92.
        $this->assertEqualsWithDelta(1.75, $h['baseline_mae'], 0.005);
        $this->assertEqualsWithDelta(1.92, $h['baseline_rmse'], 0.005);
    }

    public function test_anchored_variant_starts_from_the_last_known_value(): void
    {
        // A perfectly steady series: both variants should be exact.
        $x = range(0, 19);
        $y = array_map(fn ($v) => 3 * $v + 5, $x);

        $h = ForecastMetrics::holdout($x, $y);

        $this->assertEqualsWithDelta(0.0, $h['anchored_mae'], 1e-9);
        $this->assertEqualsWithDelta(1.0, $h['anchored_r2'], 1e-9);
    }

    public function test_fewer_than_ten_points_are_scored_in_sample(): void
    {
        $h = ForecastMetrics::holdout([0, 1, 2, 3], [1, 3, 5, 7]);

        $this->assertNull($h['test_r2']);
        $this->assertEqualsWithDelta(1.0, $h['train_r2'], 1e-9);
        $this->assertEqualsWithDelta(2.0, $h['slope'], 1e-9);
    }

    public function test_confidence_labels_match_the_forecast(): void
    {
        $this->assertSame('High', ForecastMetrics::confidenceLabel(0.7));
        $this->assertSame('Medium', ForecastMetrics::confidenceLabel(0.4));
        $this->assertSame('Low', ForecastMetrics::confidenceLabel(0.39));
    }

    public function test_poisson_draws_average_out_to_lambda(): void
    {
        $state = 12345;
        $uniform = function () use (&$state) {
            $state = (1664525 * $state + 1013904223) % 4294967296;
            return ($state + 1) / 4294967297;
        };

        $n = 20000;
        $sum = 0;
        $sumSq = 0;
        for ($i = 0; $i < $n; $i++) {
            $k = ForecastMetrics::poisson(1.6, $uniform);
            $sum += $k;
            $sumSq += $k * $k;
        }
        $mean = $sum / $n;
        $variance = $sumSq / $n - $mean ** 2;

        // For a Poisson distribution the mean and the variance both equal λ.
        $this->assertEqualsWithDelta(1.6, $mean, 0.05);
        $this->assertEqualsWithDelta(1.6, $variance, 0.1);
    }
}

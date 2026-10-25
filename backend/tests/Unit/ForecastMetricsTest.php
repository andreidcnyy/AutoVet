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
        // The guide scores the fitted line with its own intercept.
        $this->assertEqualsWithDelta(0.89, $h['fitted_r2'], 0.005);
        $this->assertEqualsWithDelta(0.49, $h['fitted_mae'], 0.005);
        $this->assertEqualsWithDelta(0.65, $h['fitted_rmse'], 0.005);
        // "Guess the average every week": MAE 1.75, RMSE 1.92.
        $this->assertEqualsWithDelta(1.75, $h['baseline_mae'], 0.005);
        $this->assertEqualsWithDelta(1.92, $h['baseline_rmse'], 0.005);
    }

    public function test_test_days_are_projected_from_the_last_training_total(): void
    {
        // Steady 2/day, then a one-off jump of 10 on the last training day.
        // The fitted line misses that jump on every test day; a projection
        // from the last known total does not.
        $x = range(0, 9);
        $y = [2, 4, 6, 8, 10, 12, 14, 26, 28, 30];

        $h = ForecastMetrics::holdout($x, $y);
        [$slope] = ForecastMetrics::fitLine(range(0, 7), array_slice($y, 0, 8));

        $expected = [26 + $slope, 26 + 2 * $slope];
        $this->assertEqualsWithDelta(ForecastMetrics::mae([28, 30], $expected), $h['mae'], 1e-9);
        $this->assertLessThan($h['fitted_mae'], $h['mae']);
    }

    public function test_baselines_project_from_the_last_training_total(): void
    {
        // Daily usage 1,1,1,1,1,1,2,6 | 3,3 — training ends on day 7 at 14 units.
        $x = range(0, 9);
        $y = [1, 2, 3, 4, 5, 6, 8, 14, 17, 20];

        $h = ForecastMetrics::holdout($x, $y);

        // Average: 14 units over 8 days = 1.75/day → 15.75, 17.5.
        $this->assertEqualsWithDelta(1.75, $h['average_rate'], 1e-9);
        $this->assertEqualsWithDelta(1.875, $h['average_mae'], 1e-9);
        // Naive: last day used 6 → 20, 26.
        $this->assertEqualsWithDelta(6.0, $h['naive_rate'], 1e-9);
        $this->assertEqualsWithDelta(4.5, $h['naive_mae'], 1e-9);
        // 7-day moving average: days 1–7 used 13 → 13/7 per day.
        $this->assertEqualsWithDelta(13 / 7, $h['moving_average_rate'], 1e-9);
        $this->assertEqualsWithDelta(12 / 7, $h['moving_average_mae'], 1e-9);
    }

    public function test_baselines_count_days_without_usage_as_zero(): void
    {
        // 2 units every other day; training ends on day 14 at 16 units.
        $x = range(0, 18, 2);
        $y = range(2, 20, 2);

        $h = ForecastMetrics::baselines($x, $y, 8);

        $this->assertEqualsWithDelta(16 / 15, $h['average_rate'], 1e-9);
        $this->assertEqualsWithDelta(2.0, $h['naive_rate'], 1e-9);
        $this->assertEqualsWithDelta(8 / 7, $h['moving_average_rate'], 1e-9);
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

<?php

namespace App\Support;

/**
 * The maths behind AutoVet's inventory forecast, in PHP.
 *
 * Mirrors ai/batch_forecast.py (scikit-learn LinearRegression + r2_score /
 * mean_squared_error / mean_absolute_error) so results can be reproduced and
 * reported without Python. Formulas are the ones in
 * "AutoVet - Model Evaluation Metrics":
 *
 *   R²   = 1 - Σ(y - ŷ)² / Σ(y - ȳ)²
 *   RMSE = √( (1/n) Σ(y - ŷ)² )
 *   MAE  = (1/n) Σ|y - ŷ|
 */
class ForecastMetrics
{
    /**
     * Ordinary least squares line through (x, y): returns [slope, intercept].
     * Same result as sklearn's LinearRegression for one feature.
     */
    public static function fitLine(array $x, array $y): array
    {
        $n = count($x);
        if ($n === 0) {
            return [0.0, 0.0];
        }

        $meanX = array_sum($x) / $n;
        $meanY = array_sum($y) / $n;

        $sxy = 0.0;
        $sxx = 0.0;
        foreach ($x as $i => $xi) {
            $sxy += ($xi - $meanX) * ($y[$i] - $meanY);
            $sxx += ($xi - $meanX) ** 2;
        }

        $slope = $sxx > 0 ? $sxy / $sxx : 0.0;
        return [$slope, $meanY - $slope * $meanX];
    }

    public static function predict(array $x, float $slope, float $intercept): array
    {
        return array_map(fn ($xi) => $slope * $xi + $intercept, $x);
    }

    /** R² = 1 − SS_res / SS_tot. 0 when every actual value is the same (as sklearn guarded in batch_forecast.py). */
    public static function r2(array $actual, array $predicted): float
    {
        $n = count($actual);
        if ($n === 0 || count(array_unique(array_map('strval', $actual))) <= 1) {
            return 0.0;
        }

        $mean = array_sum($actual) / $n;
        $ssRes = 0.0;
        $ssTot = 0.0;
        foreach ($actual as $i => $y) {
            $ssRes += ($y - $predicted[$i]) ** 2;
            $ssTot += ($y - $mean) ** 2;
        }

        return $ssTot > 0 ? 1 - $ssRes / $ssTot : 0.0;
    }

    public static function rmse(array $actual, array $predicted): float
    {
        $n = count($actual);
        if ($n === 0) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($actual as $i => $y) {
            $sum += ($y - $predicted[$i]) ** 2;
        }

        return sqrt($sum / $n);
    }

    public static function mae(array $actual, array $predicted): float
    {
        $n = count($actual);
        if ($n === 0) {
            return 0.0;
        }

        $sum = 0.0;
        foreach ($actual as $i => $y) {
            $sum += abs($y - $predicted[$i]);
        }

        return $sum / $n;
    }

    /** AutoVet's confidence label for an R² (ai/forecast.py _confidence_level). */
    public static function confidenceLabel(float $r2): string
    {
        return $r2 >= 0.7 ? 'High' : ($r2 >= 0.4 ? 'Medium' : 'Low');
    }

    /**
     * The 80/20 check from the forecast: learn the line on the oldest 80% of
     * points, measure it on the newest 20%. Below 10 points everything is
     * scored in-sample, exactly as batch_forecast.py does.
     *
     * Also reports the "guess the average" baseline on the same test points,
     * which is what R² compares against.
     */
    public static function holdout(array $x, array $y, int $minSplit = 10): array
    {
        $n = count($x);

        if ($n >= $minSplit) {
            $split = (int) floor($n * 0.8);
            [$trainX, $testX] = [array_slice($x, 0, $split), array_slice($x, $split)];
            [$trainY, $testY] = [array_slice($y, 0, $split), array_slice($y, $split)];

            [$slope, $intercept] = self::fitLine($trainX, $trainY);
            $trainPred = self::predict($trainX, $slope, $intercept);
            $testPred = self::predict($testX, $slope, $intercept);
            $testMean = array_fill(0, count($testY), array_sum($testY) / count($testY));

            // Same learned slope, but the line starts from the last known
            // total instead of the fitted intercept. Measured alongside the
            // system's method as a possible improvement; not used by it.
            $anchor = $trainY[count($trainY) - 1];
            $anchorX = $trainX[count($trainX) - 1];
            $anchoredPred = array_map(fn ($xi) => $anchor + $slope * ($xi - $anchorX), $testX);

            return self::baselines($x, $y, $split) + [
                'anchored_r2'   => self::r2($testY, $anchoredPred),
                'anchored_rmse' => self::rmse($testY, $anchoredPred),
                'anchored_mae'  => self::mae($testY, $anchoredPred),
                'method'        => '80/20 holdout',
                'train_points'  => $split,
                'test_points'   => count($testX),
                'slope'         => $slope,
                'intercept'     => $intercept,
                'train_r2'      => self::r2($trainY, $trainPred),
                'test_r2'       => self::r2($testY, $testPred),
                'rmse'          => self::rmse($testY, $testPred),
                'mae'           => self::mae($testY, $testPred),
                'baseline_rmse' => self::rmse($testY, $testMean),
                'baseline_mae'  => self::mae($testY, $testMean),
                'split_index'   => $split,
            ];
        }

        [$slope, $intercept] = self::fitLine($x, $y);
        $pred = self::predict($x, $slope, $intercept);
        $mean = $n ? array_fill(0, $n, array_sum($y) / $n) : [];

        return [
            'method'        => 'in-sample (insufficient data for split)',
            'train_points'  => $n,
            'test_points'   => 0,
            'slope'         => $slope,
            'intercept'     => $intercept,
            'train_r2'      => self::r2($y, $pred),
            'test_r2'       => null,
            'rmse'          => self::rmse($y, $pred),
            'mae'           => self::mae($y, $pred),
            'baseline_rmse' => self::rmse($y, $mean),
            'baseline_mae'  => self::mae($y, $mean),
            'split_index'   => null,
        ];
    }

    /**
     * The simple forecasting methods the model is benchmarked against
     * (Hyndman & Athanasopoulos, Forecasting: Principles and Practice), scored
     * on the same test points as the model.
     *
     * Each one guesses a daily usage from the training days only, then
     * projects the running total forward from the last known total:
     *
     *   - average:        total used ÷ calendar days in training;
     *   - naive:          the usage on the last training day;
     *   - moving average: total used in the last $window calendar days ÷ $window.
     *
     * Days missing from $x had no usage and count as 0.
     */
    public static function baselines(array $x, array $y, int $split, int $window = 7): array
    {
        $lastX = $x[$split - 1];
        $lastY = $y[$split - 1];
        $testX = array_slice($x, $split);
        $testY = array_slice($y, $split);

        $recent = 0.0;
        for ($i = 0; $i < $split; $i++) {
            if ($x[$i] > $lastX - $window) {
                $recent += $y[$i] - ($i > 0 ? $y[$i - 1] : 0.0);
            }
        }

        $rates = [
            'average'        => $lastY / ($lastX - $x[0] + 1),
            'naive'          => $lastY - ($split > 1 ? $y[$split - 2] : 0.0),
            'moving_average' => $recent / $window,
        ];

        $out = [];
        foreach ($rates as $name => $rate) {
            $pred = array_map(fn ($xi) => $lastY + $rate * ($xi - $lastX), $testX);
            $out["{$name}_rate"] = $rate;
            $out["{$name}_mae"] = self::mae($testY, $pred);
            $out["{$name}_rmse"] = self::rmse($testY, $pred);
        }

        return $out;
    }

    /** One draw from a Poisson(λ) distribution using the given random source (Knuth's method). */
    public static function poisson(float $lambda, callable $uniform): int
    {
        if ($lambda <= 0) {
            return 0;
        }

        // Knuth's method underflows for large λ; a normal approximation is
        // accurate there (λ ≥ 30 is far above any item's daily rate here).
        if ($lambda >= 30) {
            $u1 = max($uniform(), 1e-12);
            $u2 = $uniform();
            $z = sqrt(-2 * log($u1)) * cos(2 * M_PI * $u2);
            return max(0, (int) round($lambda + sqrt($lambda) * $z));
        }

        $limit = exp(-$lambda);
        $k = 0;
        $p = 1.0;
        do {
            $k++;
            $p *= $uniform();
        } while ($p > $limit);

        return $k - 1;
    }
}

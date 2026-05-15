import unittest
import os
import tempfile
import pandas as pd
from forecast import forecast_stockout


class TestForecastStockout(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temp_dir.cleanup()

    def create_csv(self, filename, data):
        filepath = os.path.join(self.temp_dir.name, filename)
        pd.DataFrame(data).to_csv(filepath, index=False)
        return filepath

    # ------------------------------------------------------------------
    # ML metadata structure
    # ------------------------------------------------------------------

    def _assert_ml_meta(self, result):
        """All successful predictions must carry full LR metadata."""
        self.assertEqual(result.get('ml_algorithm'), 'scikit-learn LinearRegression')
        self.assertIn('regression_slope', result)
        self.assertIn('regression_intercept', result)
        self.assertIn('trend_fit_score', result)
        self.assertIn('confidence_score', result)
        self.assertIn('confidence_level', result)
        self.assertIn('validation_method', result)
        self.assertIn(result.get('confidence_level'), ['High', 'Medium', 'Low'])

    # ------------------------------------------------------------------
    # Core prediction scenarios
    # ------------------------------------------------------------------

    def test_decreasing_stock_trend(self):
        # Steady decline: 10 units consumed every 2 days → ~5 units/day
        data = {
            'date':        ['2023-01-01', '2023-01-03', '2023-01-05', '2023-01-07', '2023-01-09'],
            'stock_level': [100,           90,           80,           70,           60],
        }
        result = forecast_stockout(self.create_csv('decreasing.csv', data), 10)

        self.assertEqual(result.get('prediction_status'), 'Success')
        self.assertGreater(result.get('days_until_stockout', 0), 0)
        self._assert_ml_meta(result)

    def test_increasing_stock_trend(self):
        # No net consumption — slope ≤ 0, no stockout predicted
        data = {
            'date':        ['2023-01-01', '2023-01-03', '2023-01-05'],
            'stock_level': [90,           95,           100],
        }
        result = forecast_stockout(self.create_csv('increasing.csv', data), 10)

        self.assertEqual(result.get('prediction_status'), 'Success')
        self.assertEqual(result.get('forecast_status'), 'Safe')
        self.assertIsNone(result.get('days_until_stockout'))

    def test_already_below_minimum(self):
        # Stock is already at or below min_stock_level → Critical, days = 0
        data = {
            'date':        ['2023-01-01', '2023-01-03', '2023-01-05'],
            'stock_level': [20,           10,           5],
        }
        result = forecast_stockout(self.create_csv('below_min.csv', data), 10)

        self.assertEqual(result.get('prediction_status'), 'Critical')
        self.assertEqual(result.get('days_until_stockout'), 0)

    def test_restock_scenario(self):
        # Two periods of consumption (2 units/day each) with a restock in between.
        # LR on cumulative drops correctly ignores restocks.
        data = {
            'date':        ['2023-01-01', '2023-01-06', '2023-01-07', '2023-01-12', '2023-01-17'],
            'stock_level': [100,           90,           190,           180,           170],
        }
        result = forecast_stockout(self.create_csv('restock.csv', data), 20)

        self.assertEqual(result.get('prediction_status'), 'Success')
        self.assertIsNotNone(result.get('days_until_stockout'))
        self.assertGreater(result.get('days_until_stockout', 0), 0)
        # LR slope must be positive (consumption is real)
        self.assertGreater(result.get('regression_slope', 0), 0)
        self._assert_ml_meta(result)

    def test_negative_stock_values(self):
        # Stock drops below zero — clamped to 0, still flagged Critical
        data = {
            'date':        ['2023-01-01', '2023-01-03', '2023-01-05'],
            'stock_level': [100,           5,            -10],
        }
        result = forecast_stockout(self.create_csv('negative.csv', data), 10)

        self.assertEqual(result.get('prediction_status'), 'Critical')

    # ------------------------------------------------------------------
    # Data quality / error paths
    # ------------------------------------------------------------------

    def test_insufficient_data(self):
        # Only 1 row — below the 3-point minimum
        data = {'date': ['2023-01-01'], 'stock_level': [100]}
        result = forecast_stockout(self.create_csv('insufficient.csv', data), 10)

        self.assertEqual(result.get('prediction_status'), 'Insufficient Data')
        self.assertIn('3 required', result.get('message', ''))

    def test_malformed_csv(self):
        data = {'wrong_col1': ['2023-01-01'], 'wrong_col2': [100]}
        result = forecast_stockout(self.create_csv('malformed.csv', data), 10)

        self.assertIn('error', result)
        self.assertIn('must contain the following columns', result.get('error', ''))

    # ------------------------------------------------------------------
    # R² confidence gate
    # ------------------------------------------------------------------

    def test_confidence_level_present(self):
        # Any prediction (regardless of R²) must carry a confidence_level
        data = {
            'date':        ['2023-01-01', '2023-01-03', '2023-01-05', '2023-01-07', '2023-01-09'],
            'stock_level': [100,           90,           80,           70,           60],
        }
        result = forecast_stockout(self.create_csv('conf.csv', data), 10)

        self.assertIn('confidence_level', result)
        self.assertIn(result['confidence_level'], ['High', 'Medium', 'Low'])

    def test_low_confidence_carries_message(self):
        # A sudden single drop produces a poor fit → Low confidence → message included
        data = {
            'date':        ['2023-01-01', '2023-01-02', '2023-01-03', '2023-01-04', '2023-01-05'],
            'stock_level': [100,           100,          100,          100,          10],
        }
        result = forecast_stockout(self.create_csv('noisy.csv', data), 5)

        if result.get('confidence_level') == 'Low':
            self.assertIn('message', result)
            self.assertIn('Low confidence', result['message'])


if __name__ == '__main__':
    unittest.main()

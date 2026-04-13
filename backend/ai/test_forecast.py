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
        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False)
        return filepath

    def test_decreasing_stock_trend(self):
        # 10 units consumed over 5 days -> 2 units/day
        data = {
            'date': ['2023-01-01', '2023-01-06'],
            'stock_level': [100, 90]
        }
        filepath = self.create_csv('decreasing.csv', data)
        result = forecast_stockout(filepath, 10)
        
        self.assertEqual(result.get('prediction_status'), 'Forecast Available')
        # 90 currently. min is 10. To deplete: 80 units. rate = 2/day. 80/2 = 40 days.
        self.assertEqual(result.get('days_until_stockout'), 40)
        
        # New ML metrics check
        self.assertIn('lr_slope', result)
        self.assertIn('lr_intercept', result)
        self.assertIn('lr_r2', result)
        self.assertIn('lr_predicted_next_stock', result)
        self.assertEqual(result.get('ml_algorithm'), 'scikit-learn LinearRegression')

    def test_increasing_stock_trend(self):
        data = {
            'date': ['2023-01-01', '2023-01-06'],
            'stock_level': [90, 100]
        }
        filepath = self.create_csv('increasing.csv', data)
        result = forecast_stockout(filepath, 10)
        self.assertEqual(result.get('prediction_status'), 'No Stockout Predicted')
        self.assertIn('No historical consumption', result.get('message'))

    def test_already_below_minimum(self):
        data = {
            'date': ['2023-01-01', '2023-01-06'],
            'stock_level': [100, 5]
        }
        filepath = self.create_csv('below_min.csv', data)
        result = forecast_stockout(filepath, 10)
        self.assertEqual(result.get('prediction_status'), 'Stockout Imminent/Occurred')

    def test_insufficient_data(self):
        data = {
            'date': ['2023-01-01'],
            'stock_level': [100]
        }
        filepath = self.create_csv('insufficient.csv', data)
        result = forecast_stockout(filepath, 10)
        self.assertTrue('error' in result)
        self.assertIn('least 2 required', result.get('error'))

    def test_malformed_csv(self):
        data = {
            'wrong_col1': ['2023-01-01'],
            'wrong_col2': [100]
        }
        filepath = self.create_csv('malformed.csv', data)
        result = forecast_stockout(filepath, 10)
        self.assertTrue('error' in result)
        self.assertIn('must contain the following columns', result.get('error'))

    def test_restock_scenario(self):
        # 10 consumed in 5 days (rate=2/day). Then restock of 100. Then 10 consumed in 5 days (rate=2/day).
        # Overall average consumption rate should be 2/day.
        data = {
            'date': ['2023-01-01', '2023-01-06', '2023-01-07', '2023-01-12'],
            'stock_level': [100, 90, 190, 180] 
        }
        filepath = self.create_csv('restock.csv', data)
        result = forecast_stockout(filepath, 20)
        
        self.assertEqual(result.get('prediction_status'), 'Forecast Available')
        # rate = 20 consumed / 10 days = 2 units / day.
        # last stock = 180. min = 20. deplete = 160. 160/2 = 80 days.
        self.assertEqual(result.get('days_until_stockout'), 80)
        
    def test_negative_values(self):
        data = {
            'date': ['2023-01-01', '2023-01-06'],
            'stock_level': [100, -10]
        }
        filepath = self.create_csv('negative.csv', data)
        result = forecast_stockout(filepath, 10)
        # -10 will be floored to 0. Rate = 100/5 = 20/day.
        # last stock = 0. min = 10.
        self.assertEqual(result.get('prediction_status'), 'Stockout Imminent/Occurred')

if __name__ == '__main__':
    unittest.main()

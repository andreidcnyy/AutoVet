<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

class PythonForecastRunner
{
    /**
     * Run the service forecast Python script.
     *
     * @param array $monthlyData Aggregated historical data.
     * @param int $horizon Number of months to forecast.
     * @return array Resulting forecast and model info.
     * @throws \Exception
     */
    public function runServiceForecast(array $monthlyData, int $horizon = 6): array
    {
        $tmpDir = storage_path('app/tmp');
        if (!is_dir($tmpDir)) mkdir($tmpDir, 0775, true);

        $tempInput  = $tmpDir . '/forecast_input.json';
        $tempOutput = $tmpDir . '/forecast_output.json';

        file_put_contents($tempInput, json_encode($monthlyData));

        $scriptPath = base_path('backend/ai/service_forecast.py');
        // Check if path exists, if not try just 'ai/service_forecast.py' as base_path already includes 'backend' sometimes
        if (!file_exists($scriptPath)) {
            $scriptPath = base_path('ai/service_forecast.py');
        }

        $pythonExecutable = env('PYTHON_BIN_PATH')
            ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        $cmd = "{$pythonExecutable} " . escapeshellarg($scriptPath)
             . " " . escapeshellarg($tempInput)
             . " " . escapeshellarg($tempOutput)
             . " " . (int)$horizon . " 2>&1";

        $shellOutput = shell_exec($cmd);

        if (!file_exists($tempOutput) || filesize($tempOutput) === 0) {
            Log::error('Forecast script failed.', ['output' => $shellOutput, 'cmd' => $cmd]);
            throw new \Exception('Forecast script failed. Check laravel.log.');
        }

        $result = json_decode(file_get_contents($tempOutput), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('Forecast output invalid JSON: ' . $shellOutput);
        }

        return $result;
    }
}

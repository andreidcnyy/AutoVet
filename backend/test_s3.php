<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Storage;
use Aws\S3\Exception\S3Exception;

$config = config('filesystems.disks.s3');
echo "S3 CONFIG (Masked):\n";
echo "Driver: " . $config['driver'] . "\n";
echo "Key: " . substr($config['key'], 0, 4) . "...\n";
echo "Secret: " . substr($config['secret'], 0, 4) . "...\n";
echo "Region: " . $config['region'] . "\n";
echo "Bucket: " . $config['bucket'] . "\n";
echo "Endpoint: " . $config['endpoint'] . "\n";
echo "Path Style: " . ($config['use_path_style_endpoint'] ? 'true' : 'false') . "\n";

try {
    echo "\nTesting S3 Connection...\n";
    Storage::disk('s3')->put('test.txt', 'test');
    echo "SUCCESS\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    if ($e->getPrevious() instanceof S3Exception) {
        echo "AWS ERROR: " . $e->getPrevious()->getAwsErrorMessage() . "\n";
    }
}

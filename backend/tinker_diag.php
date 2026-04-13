<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "--- STEP 2 ---\n";
try {
    $results = DB::select('SELECT tokenable_type, tokenable_id FROM personal_access_tokens LIMIT 10');
    foreach ($results as $r) {
        echo $r->tokenable_type . ' | ' . $r->tokenable_id . "\n";
    }
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 3 ---\n";
try {
    $results = DB::select('DESCRIBE personal_access_tokens');
    $fields = array_map(fn($r) => $r->Field, $results);
    echo implode(', ', $fields) . "\n";
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

echo "\n--- STEP 5 ---\n";
try {
    DB::table('personal_access_tokens')->select('tokenable_type')->distinct()->get()->each(fn($r) => print($r->tokenable_type . PHP_EOL));
} catch (\Throwable $e) { echo "Error: " . $e->getMessage() . "\n"; }

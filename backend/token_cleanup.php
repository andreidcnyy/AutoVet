<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$deleted = DB::table('personal_access_tokens')->where('tokenable_type', 'App\Models\User')->delete();
echo 'Deleted stale tokens: ' . $deleted . PHP_EOL;

$remaining = DB::table('personal_access_tokens')->select('tokenable_type')->distinct()->get();
foreach($remaining as $r) echo 'Remaining type: ' . $r->tokenable_type . PHP_EOL;

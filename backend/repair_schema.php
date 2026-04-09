<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- STARTING DATABASE REPAIR ---\n";

try {
    // 1. Disable FK checks
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    echo "Foreign key checks disabled.\n";

    // 2. Drop the problematic table
    Schema::dropIfExists('users');
    echo "Table 'users' dropped successfully.\n";

    // 3. Clean up any orphaned personal_access_tokens
    DB::table('personal_access_tokens')->where('tokenable_type', 'App\Models\User')->delete();
    echo "Cleaned up old personal access tokens.\n";

    // 4. Re-enable FK checks
    DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    echo "Foreign key checks re-enabled.\n";

    echo "\n--- REPAIR COMPLETE ---\n";

} catch (\Exception $e) {
    echo "REPAIR FAILED: " . $e->getMessage() . "\n";
}

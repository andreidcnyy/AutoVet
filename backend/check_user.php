<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$emails = ['admin@autovet.com', 'portal@autovet.com'];
$passwordToCheck = 'password123';

foreach ($emails as $email) {
    $user = User::where('email', $email)->first();
    if ($user) {
        echo "User: $email\n";
        echo "Role: {$user->role}\n";
        echo "Status: {$user->status}\n";
        echo "Password Match: " . (Hash::check($passwordToCheck, $user->password) ? "YES" : "NO") . "\n";
        echo "-------------------\n";
    } else {
        echo "User: $email NOT FOUND\n";
        echo "-------------------\n";
    }
}

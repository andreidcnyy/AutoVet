<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\Admin;
use App\Models\PortalUser;
use Illuminate\Support\Facades\Hash;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- ADMINS TABLE ---\n";
$admin = Admin::where('email', 'admin@autovet.com')->first();
if ($admin) {
    echo "Admin: {$admin->email}, Role: {$admin->role}, Password Match: " . (Hash::check('password123', $admin->password) ? "YES" : "NO") . "\n";
} else {
    echo "Admin admin@autovet.com NOT FOUND\n";
}

echo "\n--- PORTAL_USERS TABLE ---\n";
$portal = PortalUser::where('email', 'portal@autovet.com')->first();
if ($portal) {
    echo "Portal User: {$portal->email}, Password Match: " . (Hash::check('password123', $portal->password) ? "YES" : "NO") . "\n";
    if ($portal->owner) {
        echo "Associated Owner: {$portal->owner->name}\n";
    } else {
        echo "No associated owner record found!\n";
    }
} else {
    echo "Portal user portal@autovet.com NOT FOUND\n";
}

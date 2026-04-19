<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\PortalUser;
use App\Models\Owner;
use App\Models\Pet;

echo "User count (admins): " . User::count() . "\n";
echo "PortalUser count: " . PortalUser::count() . "\n";
echo "Owner count: " . Owner::count() . "\n";
echo "Pet count: " . Pet::count() . "\n";

echo "\n--- PortalUsers ---\n";
foreach (PortalUser::all() as $u) {
    echo "ID: " . $u->id . " Email: " . $u->email . " Name: " . $u->name . "\n";
}

echo "\n--- Owners ---\n";
foreach (Owner::all() as $owner) {
    echo "ID: " . $owner->id . " Name: " . $owner->name . " User ID: " . $owner->user_id . " Email: " . $owner->email . "\n";
}

echo "\n--- Pets ---\n";
foreach (Pet::all() as $pet) {
    echo "ID: " . $pet->id . " Name: " . $pet->name . " Owner ID: " . $pet->owner_id . "\n";
}

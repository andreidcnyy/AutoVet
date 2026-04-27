<?php

/**
 * AUTOVET EMERGENCY DATABASE INITIALIZER
 * This script bypasses Laravel routing to ensure DB setup can happen.
 */

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;
use App\Models\Clinic;
use App\Enums\Roles;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

header('Content-Type: application/json');

try {
    echo json_encode(["status" => "Starting migration..."]);
    
    // 1. Run Migrations
    Artisan::call('migrate', ['--force' => true]);
    
    // 2. Ensure Super Admin
    $email = 'superadmin@autovet.com';
    $admin = Admin::where('email', $email)->first();
    
    if (!$admin) {
        $clinic = Clinic::first();
        if (!$clinic) {
            $clinic = Clinic::create([
                'clinic_name' => 'AutoVet Headquarters',
                'email' => 'system@autovet.com',
                'status' => 'active',
            ]);
        }

        Admin::create([
            'name' => 'Super Administrator',
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => Roles::SUPER_ADMIN->value,
            'status' => 'active',
            'clinic_id' => $clinic->id,
        ]);
        
        echo json_encode([
            "success" => true,
            "message" => "Database initialized and Super Admin created.",
            "user" => $email
        ]);
    } else {
        echo json_encode([
            "success" => true,
            "message" => "Database already initialized.",
            "user" => $email
        ]);
    }

} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage(),
        "trace" => $e->getTraceAsString()
    ]);
}

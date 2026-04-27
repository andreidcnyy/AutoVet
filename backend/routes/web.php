<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Emergency Database Setup Route (Web version)
Route::get('/init-db', function () {
    try {
        // Force migrations
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        
        // Ensure a Super Admin exists
        $superAdminEmail = 'superadmin@autovet.com';
        $admin = \App\Models\Admin::where('email', $superAdminEmail)->first();
        
        if (!$admin) {
            // Check if we have a clinic to assign to
            $clinic = \App\Models\Clinic::first();
            if (!$clinic) {
                $clinic = \App\Models\Clinic::create([
                    'clinic_name' => 'AutoVet Headquarters',
                    'email' => 'system@autovet.com',
                    'status' => 'active',
                ]);
            }

            \App\Models\Admin::create([
                'name' => 'Super Administrator',
                'email' => $superAdminEmail,
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role' => \App\Enums\Roles::SUPER_ADMIN->value,
                'status' => 'active',
                'clinic_id' => $clinic->id,
            ]);
            return response()->json(['message' => 'Database initialized. Super Admin created: ' . $superAdminEmail]);
        }

        return response()->json(['message' => 'Database already initialized. Super Admin exists: ' . $superAdminEmail]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
    }
});

Route::get('/status', function () {
    return response()->json(['status' => 'running', 'env' => app()->environment()]);
});



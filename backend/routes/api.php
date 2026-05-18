<?php

use App\Http\Controllers\InventoryForecastController;
use App\Http\Controllers\ImportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Enums\Roles;

// Chunked Setup Wizard Endpoint — blocked on production
Route::get('/run-setup-step', function (\Illuminate\Http\Request $request) {
    if (app()->environment('production')) {
        return response()->json(['error' => 'Not available in production.'], 404);
    }
    set_time_limit(600); // 10 minutes total
    $step = $request->query('step');
    
    try {
        switch ($step) {
            case 'migrate':
                \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
                
                // Ensure Clinic exists immediately
                if (!\App\Models\Clinic::first()) {
                    \App\Models\Clinic::create([
                        'clinic_name' => 'AutoVet Headquarters',
                        'email' => 'system@autovet.com',
                        'status' => 'active',
                    ]);
                }
                break;
                
            case 'seed_core':
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'MasterDataSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'MeasurementSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'StandardPetSizesSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'StandardBreedsSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'SettingSeeder', '--force' => true]);
                break;
                
            case 'seed_users':
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'AdminUserSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'PortalUserSeeder', '--force' => true]);
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'PatientPetSeeder', '--force' => true]);
                break;

            case 'seed_ai':
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
                break;

            case 'seed_bulk':
                \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'BulkProductionMockSeeder', '--force' => true]);
                break;

            case 'align':
                $clinicId = \App\Models\Clinic::first()->id;
                $newPassword = \Illuminate\Support\Facades\Hash::make('password123');

                \App\Models\Admin::withoutGlobalScopes()->withTrashed()->update([
                    'password' => $newPassword,
                    'status' => 'active',
                    'deleted_at' => null,
                    'clinic_id' => $clinicId
                ]);

                $tables = [
                    'owners', 'pets', 'patients', 'appointments', 'invoices', 'invoice_items',
                    'inventories', 'services', 'medical_records', 'notifications', 
                    'client_notifications', 'inventory_transactions', 'inventory_forecasts',
                    'inventory_usage_history', 'inventory_categories', 'service_categories',
                    'species', 'breeds', 'vet_schedules', 'audit_logs', 'cms_contents', 'settings',
                    'pet_size_categories'
                ];
                
                foreach ($tables as $table) {
                    if (\Illuminate\Support\Facades\Schema::hasTable($table) && \Illuminate\Support\Facades\Schema::hasColumn($table, 'clinic_id')) {
                        \Illuminate\Support\Facades\DB::table($table)->where('clinic_id', '!=', $clinicId)->orWhereNull('clinic_id')->update(['clinic_id' => $clinicId]);
                    }
                }

                \Illuminate\Support\Facades\Artisan::call('cache:clear');
                break;
                
            default:
                return response()->json(['error' => 'Unknown step'], 400);
        }

        return response()->json([
            'success' => true,
            'diagnostic' => [
                'pets' => \App\Models\Pet::withoutGlobalScopes()->count(),
                'owners' => \App\Models\Owner::withoutGlobalScopes()->count(),
                'appts' => \App\Models\Appointment::withoutGlobalScopes()->count(),
                'sizes' => \Illuminate\Support\Facades\DB::table('pet_size_categories')->count(),
            ]
        ]);

    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});


use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AppointmentStatusController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MedicalRecordController;
use App\Http\Controllers\NotificationTemplateController;
use App\Http\Controllers\PatientOwnerController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VetScheduleController;
use App\Http\Controllers\CmsContentController;
use App\Http\Controllers\ClientNotificationController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\SalesReportController;
use App\Http\Controllers\PatientReportController;
use App\Http\Controllers\LowStockReportController;

use App\Http\Controllers\PetSizeCategoryController;
use App\Http\Controllers\UnitOfMeasureController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\BreedController;
use App\Http\Controllers\WeightRangeController;
use App\Models\Owner;

// ---------------------------------------------------------------------------
// Public-facing routes (Login, Registration, etc.)
// ---------------------------------------------------------------------------

Route::post('/auth/google',     [GoogleAuthController::class, 'handle'])->middleware('throttle:10,1');
Route::post('/login',           [AuthController::class, 'login'])->middleware('throttle:10,1')->name('login');
Route::post('/register',        [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/password/forgot', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/password/reset',  [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/register/verify', [AuthController::class, 'verifyRegistration'])->name('registration.verify');

// Diagnostic endpoint — gated to prevent unauthenticated data exposure.
// Set DEBUG_MAIL_TOKEN on Railway and call ?token=<value> to access.
Route::get('/debug/mail', function (\Illuminate\Http\Request $request) {
    $expected = env('DEBUG_MAIL_TOKEN');
    if (empty($expected) || $request->query('token') !== $expected) {
        return response()->json(['error' => 'forbidden'], 403);
    }
    $report = [
        'mail_mailer_env' => env('MAIL_MAILER'),
        'brevo_key_present' => !empty(env('BREVO_API_KEY')),
        'mail_from_address' => env('MAIL_FROM_ADDRESS'),
        'mail_from_name' => env('MAIL_FROM_NAME'),
        'frontend_portal_url' => env('FRONTEND_PORTAL_URL'),
        'app_env' => app()->environment(),
        'migrations_pending' => null,
        'notification_templates' => [],
        'send_attempt' => null,
    ];

    try {
        $report['migrations_pending'] = collect(\Illuminate\Support\Facades\Artisan::call('migrate:status') === 0
            ? explode("\n", \Illuminate\Support\Facades\Artisan::output())
            : [])->filter(fn($l) => str_contains($l, 'Pending'))->values()->all();
    } catch (\Throwable $e) {
        $report['migrations_pending'] = 'error: ' . $e->getMessage();
    }

    try {
        $report['notification_templates'] = \Illuminate\Support\Facades\DB::table('notification_templates')
            ->select('id', 'clinic_id', 'event_key', 'channel', 'is_active', 'name')
            ->get()
            ->map(fn($t) => (array) $t)
            ->all();
    } catch (\Throwable $e) {
        $report['notification_templates'] = 'error: ' . $e->getMessage();
    }

    try {
        $report['recent_client_notifications'] = \Illuminate\Support\Facades\DB::table('client_notifications')
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get()
            ->map(fn($n) => (array) $n)
            ->all();
    } catch (\Throwable $e) {
        $report['recent_client_notifications'] = 'error: ' . $e->getMessage();
    }

    try {
        $report['recent_appointments'] = \Illuminate\Support\Facades\DB::table('appointments')
            ->orderBy('id', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($n) => (array) $n)
            ->all();
    } catch (\Throwable $e) {
        $report['recent_appointments'] = 'error: ' . $e->getMessage();
    }

    if ($apptId = $request->query('repro')) {
        try {
            $appt = \App\Models\Appointment::withoutGlobalScopes()->find($apptId);
            if (!$appt) {
                $report['repro'] = ['error' => 'appt not found'];
            } else {
                $pet = \App\Models\Pet::withoutGlobalScopes()->find($appt->pet_id);
                $owner = $pet ? \App\Models\Owner::withoutGlobalScopes()->find($pet->owner_id) : null;
                $portalUser = $owner && $owner->user_id ? \App\Models\PortalUser::withoutGlobalScopes()->find($owner->user_id) : null;

                if (!$portalUser) {
                    $report['repro'] = ['error' => 'no portal user for this appointment owner'];
                } else {
                    \Illuminate\Support\Facades\Auth::login($portalUser);

                    $apptScoped = \App\Models\Appointment::find($apptId);
                    if ($apptScoped) {
                        $apptScoped->load('pet.owner');
                    }

                    $report['repro'] = [
                        'logged_in_as' => ['portal_user_id' => $portalUser->id, 'clinic_id' => $portalUser->clinic_id, 'email' => $portalUser->email],
                        'appt_loadable_under_scope' => (bool) $apptScoped,
                        'pet_loadable_under_scope' => (bool) ($apptScoped?->pet),
                        'owner_loadable_under_scope' => (bool) ($apptScoped?->pet?->owner),
                        'owner_email_under_scope' => $apptScoped?->pet?->owner?->email,
                    ];

                    if ($apptScoped?->pet?->owner) {
                        try {
                            $svc = app(\App\Services\ClientNotificationService::class);
                            $svc->sendFromTemplate(
                                $apptScoped->pet->owner,
                                'appointment_created',
                                'email',
                                ['date' => $apptScoped->date, 'time' => $apptScoped->time, 'title' => $apptScoped->title],
                                'automated',
                                $apptScoped
                            );
                            $report['repro']['send_result'] = 'ok';
                        } catch (\Throwable $e) {
                            $report['repro']['send_result'] = ['error' => $e->getMessage(), 'class' => get_class($e)];
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $report['repro'] = ['error' => $e->getMessage()];
        }
    }

    if ($apptId = $request->query('appt')) {
        try {
            $appt = \App\Models\Appointment::withoutGlobalScopes()->find($apptId);
            $pet = $appt ? \App\Models\Pet::withoutGlobalScopes()->find($appt->pet_id) : null;
            $owner = $pet ? \App\Models\Owner::withoutGlobalScopes()->find($pet->owner_id) : null;
            $report['inspect_appt'] = [
                'appt_id' => $apptId,
                'appointment' => $appt ? $appt->toArray() : null,
                'pet' => $pet ? $pet->toArray() : null,
                'pet_owner_id' => $pet?->owner_id,
                'owner' => $owner ? $owner->toArray() : null,
                'owner_email' => $owner?->email,
            ];
        } catch (\Throwable $e) {
            $report['inspect_appt'] = ['error' => $e->getMessage()];
        }
    }

    if ($to = $request->query('to')) {
        try {
            \Illuminate\Support\Facades\Mail::mailer('appointment')
                ->to($to)
                ->send(new \App\Mail\ClientNotificationMail('Debug send', 'If you can read this, Brevo + the appointment mailer work end-to-end.'));
            $report['send_attempt'] = ['ok' => true, 'to' => $to];
        } catch (\Throwable $e) {
            $report['send_attempt'] = [
                'ok' => false,
                'to' => $to,
                'error' => $e->getMessage(),
                'class' => get_class($e),
            ];
        }
    }

    return response()->json($report, 200, [], JSON_PRETTY_PRINT);
});

// Test endpoint to check API status
Route::get('/status', function () {
    $dbStatus = 'disconnected';
    $userCount = 0;
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $dbStatus = 'connected';
        $userCount = \App\Models\Admin::withoutGlobalScopes()->withTrashed()->count();
    } catch (\Exception $e) {
        // Leave as disconnected
    }

    return response()->json([
        'status'    => 'success',
        'message'   => 'AutoVet Laravel API is up and running!',
        'database'  => $dbStatus,
        'user_count' => $userCount,
        'environment' => app()->environment(),
        'timestamp' => now()->toIso8601String(),
    ]);
});

// ---------------------------------------------------------------------------
// Authenticated routes — all require a valid Sanctum token
// ---------------------------------------------------------------------------

Route::group(['middleware' => ['auth:sanctum']], function () {

    // -----------------------------------------------------------------------
    // User profile
    // -----------------------------------------------------------------------
    Route::get('/user',     function (Request $request) { return $request->user(); });
    Route::get('/vets',     [UserController::class, 'vets']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/logout',          [AuthController::class, 'logout']);

    Route::get('/profile',          [ProfileController::class, 'show']);
    Route::put('/profile',          [ProfileController::class, 'update']);
    Route::post('/profile/complete', [ProfileController::class, 'completeProfile']);
    Route::get('/profile/devices',              [ProfileController::class, 'devices']);
    Route::delete('/profile/devices/{id}',      [ProfileController::class, 'revokeDevice']);
    Route::delete('/profile/devices',           [ProfileController::class, 'revokeOtherDevices']);

    // -----------------------------------------------------------------------
    // Dashboard & Metrics
    // -----------------------------------------------------------------------
    Route::get('/dashboard/overview',              [DashboardController::class, 'getOverview']);
    Route::get('/portal/overview',                 [DashboardController::class, 'getPortalOverview']);
    Route::get('/dashboard/stats',                 [DashboardController::class, 'getStats']);
    Route::post('/ai/clinical-support',             [\App\Http\Controllers\AiDiagnosisController::class, 'getSuggestions']);
    Route::get('/dashboard/notifications',         [DashboardController::class, 'getNotifications']);
    Route::post('/dashboard/notifications/mark-all-read', [DashboardController::class, 'markAllRead']);
    Route::post('/dashboard/notifications/clear-all', [DashboardController::class, 'clearAll']);
    Route::post('/dashboard/notifications/{id}/dismiss', [DashboardController::class, 'dismissNotification']);
    Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
    Route::get('/dashboard/inventory-forecast',    [DashboardController::class, 'getInventoryForecasts']);
    Route::post('/dashboard/run-forecast',          [DashboardController::class, 'runForecastSync']);
    Route::get('/dashboard/forecast-status',       [DashboardController::class, 'getForecastStatus']);
    Route::get('/dashboard/appointment-forecast',  [DashboardController::class, 'getAppointmentForecast']);
    Route::get('/dashboard/patient-visit-predictions', [DashboardController::class, 'getPatientVisitPredictions']);
    Route::get('/dashboard/appointments/today',    [DashboardController::class, 'appointmentsToday']);
    Route::get('/dashboard/appointments/upcoming', [DashboardController::class, 'appointmentsUpcoming']);
    Route::get('/dashboard/pets',                  [DashboardController::class, 'petsList']);
    Route::get('/dashboard/clients',               [DashboardController::class, 'clientsList']);
    Route::get('/dashboard/appointments/cancelled',[DashboardController::class, 'appointmentsCancelled']);
    Route::get('/dashboard/analytics/monthly-clients',   [DashboardController::class, 'getMonthlyClients']);
    Route::get('/dashboard/analytics/items-by-category', [DashboardController::class, 'getItemsByCategory']);

    // -----------------------------------------------------------------------
    // Core Modules
    // -----------------------------------------------------------------------
    Route::post('appointments/{appointment}/approve', [AppointmentStatusController::class, 'approve']);
    Route::post('appointments/{appointment}/decline', [AppointmentStatusController::class, 'decline']);
    Route::post('appointments/{appointment}/remind', [AppointmentStatusController::class, 'remind']);
    Route::get('/appointments/availability',      [\App\Http\Controllers\AppointmentController::class, 'getAvailability']);
    Route::get('/appointments/summary', [AppointmentController::class, 'summary']);
    Route::apiResource('appointments', AppointmentController::class);
    // Inventory and Specialized Forecast
    Route::get('inventory/low-stock',     [InventoryController::class, 'lowStock']);
    Route::get('inventory/{inventory}/transactions', [InventoryController::class, 'transactions']);
    Route::post('inventory/{inventory}/accept-forecast', [InventoryController::class, 'acceptForecastRecommendation']);
    Route::get('inventory/{inventory}/forecast',         [\App\Http\Controllers\InventoryForecastController::class, 'forecast']);
    Route::get('inventory/{inventory}/forecast/saved',   [\App\Http\Controllers\InventoryForecastController::class, 'savedForecast']);
    Route::get('inventory/{inventory}/forecast/history', [\App\Http\Controllers\InventoryForecastController::class, 'forecastHistory']);
    Route::apiResource('inventory',       InventoryController::class);

    Route::apiResource('invoices',        InvoiceController::class);
    Route::apiResource('reports',         InvoiceController::class)->parameters(['reports' => 'invoice']);
    Route::apiResource('services',        ServiceController::class);
    Route::apiResource('medical-records', MedicalRecordController::class);

    Route::apiResource('owners', PatientOwnerController::class);
    Route::apiResource('pets',            \App\Http\Controllers\PetController::class);
    Route::post('vet-schedules/bulk',    [VetScheduleController::class, 'bulkStore']);
    Route::apiResource('vet-schedules',   VetScheduleController::class);
    
    // Data Import Routes
    Route::prefix('import')->group(function () {
        Route::post('/owners', [ImportController::class, 'importOwners']);
        Route::post('/appointments', [ImportController::class, 'importAppointments']);
        Route::post('/invoices', [ImportController::class, 'importInvoices']);
        Route::post('/inventory-usage', [ImportController::class, 'importInventoryUsage']);
        Route::post('/services', [ImportController::class, 'importServices']);
    });

    // -----------------------------------------------------------------------
    // Client Notifications
    // -----------------------------------------------------------------------
    Route::apiResource('client-notifications/templates', NotificationTemplateController::class);
    Route::get('/client-notifications',           [ClientNotificationController::class, 'index']);
    Route::post('/client-notifications/send',      [ClientNotificationController::class, 'send']);
    Route::post('/client-notifications/send-invoice', [ClientNotificationController::class, 'sendInvoice']);

    Route::get('/notifications',                  [ClientNotificationController::class, 'portalIndex']);
    Route::put('/notifications/{id}',             [ClientNotificationController::class, 'markAsRead']);

    // Synchronization Trigger
    Route::post('/sync/trigger', function (\App\Services\SyncService $syncService) {
        $syncService->pushToPortal();
        return response()->json(['status' => 'triggered']);
    });

    // -----------------------------------------------------------------------
    // Master Data Management
    // -----------------------------------------------------------------------
    Route::get('/inventory-categories', [\App\Http\Controllers\InventoryCategoryController::class, 'index']);
    Route::get('/service-categories',    [\App\Http\Controllers\ServiceCategoryController::class, 'index']);

    Route::apiResource('pet-size-categories', PetSizeCategoryController::class);
    Route::apiResource('units-of-measure',    UnitOfMeasureController::class);
    Route::apiResource('species',             SpeciesController::class);
    Route::apiResource('breeds',              BreedController::class);
    Route::apiResource('weight-ranges',       WeightRangeController::class);

    // Master Data Write Access - Admin only
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::apiResource('inventory-categories', \App\Http\Controllers\InventoryCategoryController::class)->except(['index']);
        Route::apiResource('service-categories',    \App\Http\Controllers\ServiceCategoryController::class)->except(['index']);
    });

    // Settings
    Route::get('/settings',  [SettingController::class, 'index']);
    Route::match(['post', 'put'], '/settings', [SettingController::class, 'update']);

    // Content Management
    Route::apiResource('cms-content', CmsContentController::class);

    // -----------------------------------------------------------------------
    // System Administration
    // -----------------------------------------------------------------------
    Route::get('/system-announcements', function() {
        return response()->json(
            \App\Models\SystemAnnouncement::where('is_active', true)
                ->where(function($q) {
                    $q->whereNull('active_until')
                      ->orWhere('active_until', '>=', \Carbon\Carbon::now('UTC'));
                })
                ->orderBy('created_at', 'desc')
                ->get()
        );
    });

    Route::group(['middleware' => 'role:super_admin'], function () {
        Route::get('/super-admin/stats', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'stats']);
        Route::get('/super-admin/clinics', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'clinics']);
        Route::post('/super-admin/clinics', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'storeClinic']);
        Route::put('/super-admin/clinics/{clinic}', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'updateClinic']);
        Route::delete('/super-admin/clinics/{clinic}', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'destroyClinic']);
        Route::post('/super-admin/clinics/{clinic}/toggle-status', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'toggleStatus']);
        
        // Super Admin Powers
        Route::get('/super-admin/clinics/{clinic}/admins', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'clinicAdmins']);
        Route::post('/super-admin/clinics/{clinic}/users', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'storeClinicUser']);
        Route::post('/super-admin/clinics/{clinic}/admins/{admin}/reset-password', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'resetClinicAdminPassword']);
        Route::post('/super-admin/impersonate/{clinic}', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'impersonate']);
        Route::get('/super-admin/system-logs', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'systemLogs']);
        Route::get('/super-admin/admins', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'superAdmins']);
        Route::post('/super-admin/admins', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'storeSuperAdmin']);
        Route::get('/super-admin/announcements', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'announcements']);
        Route::post('/super-admin/announcements', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'storeAnnouncement']);
        Route::put('/super-admin/announcements/{announcement}', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'updateAnnouncement']);
        Route::delete('/super-admin/announcements/{announcement}', [\App\Http\Controllers\Api\SuperAdminDashboardController::class, 'destroyAnnouncement']);
    });

    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        // Audit Logs
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        // Backup & Restore
        Route::get('/backups',                     [BackupController::class, 'index']);
        Route::post('/backups',                    [BackupController::class, 'create']);
        Route::post('/backups/restore',            [BackupController::class, 'restore']);
        Route::get('/backups/download/{filename}', [BackupController::class, 'download']);
        Route::delete('/backups/{filename}',       [BackupController::class, 'destroy']);

        // Archive & Recovery
        Route::get('/archives/{type}',              [ArchiveController::class, 'index']);
        Route::post('/archives/{type}/{id}/restore', [ArchiveController::class, 'restore']);
        Route::delete('/archives/{type}/{id}/force', [ArchiveController::class, 'forceDelete']);
    });

    // -----------------------------------------------------------------------
    // User Management — Admin & Vet Access
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });

    // -----------------------------------------------------------------------
    // Reporting
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        // Sales Reports
        Route::get('/reports/sales/revenue-summary',   [SalesReportController::class, 'getRevenueSummary']);
        Route::get('/reports/sales/top-services',      [SalesReportController::class, 'getTopServices']);
        Route::get('/reports/sales/transaction-volume', [SalesReportController::class, 'getTransactionVolume']);

        // Patient Reports
        Route::get('/reports/patients/species-distribution', [PatientReportController::class, 'getSpeciesDistribution']);
        Route::get('/reports/patients/registration-trends',  [PatientReportController::class, 'getRegistrationTrends']);
        Route::get('/reports/patients/demographics',         [PatientReportController::class, 'getDemographics']);

        // Inventory Reports
        Route::get('/reports/inventory/low-stock', [LowStockReportController::class, 'generate']);

        // Analytics (feeds linear regression from real invoice + usage data)
        Route::get('/reports/analytics/transaction-trends', [\App\Http\Controllers\ReportAnalyticsController::class, 'transactionTrends']);
        Route::get('/reports/analytics/transaction-stats',  [\App\Http\Controllers\ReportAnalyticsController::class, 'transactionStats']);
        Route::get('/reports/analytics/inventory-consumption', [\App\Http\Controllers\ReportAnalyticsController::class, 'inventoryConsumption']);
        Route::get('/reports/analytics/inventory-stock',    [\App\Http\Controllers\ReportAnalyticsController::class, 'inventoryStockSummary']);
    });
});

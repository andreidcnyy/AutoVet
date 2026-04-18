<?php

use App\Http\Controllers\InventoryForecastController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Enums\Roles;


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

Route::post('/login',           [AuthController::class, 'login'])->name('login');
Route::post('/register',        [AuthController::class, 'register']);
Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('/password/reset',  [AuthController::class, 'resetPassword']);

// Test endpoint to check API status
Route::get('/status', function () {
    $dbStatus = 'disconnected';
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        // Leave as disconnected
    }

    return response()->json([
        'status'    => 'success',
        'message'   => 'AutoVet Laravel API is up and running!',
        'database'  => $dbStatus,
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

    // -----------------------------------------------------------------------
    // Dashboard & Metrics
    // -----------------------------------------------------------------------
    Route::get('/dashboard/overview',              [DashboardController::class, 'getOverview']);
    Route::get('/portal/overview',                 [DashboardController::class, 'getPortalOverview']);
    Route::get('/dashboard/stats',                 [DashboardController::class, 'getStats']);
    Route::get('/dashboard/notifications',         [DashboardController::class, 'getNotifications']);
    Route::post('/dashboard/notifications/mark-all-read', [DashboardController::class, 'markNotificationsRead']);
    Route::post('/dashboard/notifications/{id}/dismiss', [DashboardController::class, 'dismissNotification']);
    Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
    Route::get('/dashboard/sales-forecast',        [DashboardController::class, 'getSalesForecast']);
    Route::get('/dashboard/inventory-forecast',    [DashboardController::class, 'getInventoryForecasts']);
    Route::post('/dashboard/run-forecast',          [DashboardController::class, 'runForecastSync']);
    Route::get('/dashboard/forecast-status',       [DashboardController::class, 'getForecastStatus']);
    Route::get('/dashboard/appointment-forecast',  [DashboardController::class, 'getAppointmentForecast']);
    Route::get('/dashboard/patient-visit-predictions', [DashboardController::class, 'getPatientVisitPredictions']);

    // -----------------------------------------------------------------------
    // Core Modules
    // -----------------------------------------------------------------------
    Route::post('appointments/{appointment}/approve', [AppointmentStatusController::class, 'approve']);
    Route::post('appointments/{appointment}/decline', [AppointmentStatusController::class, 'decline']);
    Route::post('appointments/{appointment}/remind', [AppointmentStatusController::class, 'remind']);
    Route::get('/appointments/availability',      [\App\Http\Controllers\AppointmentController::class, 'getAvailability']);
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
    Route::apiResource('services',        ServiceController::class);
    Route::apiResource('medical-records', MedicalRecordController::class);

    Route::apiResource('owners', PatientOwnerController::class);
    Route::apiResource('pets',            \App\Http\Controllers\PetController::class);
    Route::post('vet-schedules/bulk',    [VetScheduleController::class, 'bulkStore']);
    Route::apiResource('vet-schedules',   VetScheduleController::class);
    Route::post('owners/import',          [PatientOwnerController::class, 'import']);

    // -----------------------------------------------------------------------
    // Client Notifications
    // -----------------------------------------------------------------------
    Route::apiResource('client-notifications/templates', NotificationTemplateController::class);
    Route::get('/client-notifications',           [ClientNotificationController::class, 'index']);
    Route::post('/client-notifications/send',      [ClientNotificationController::class, 'send']);
    Route::post('/client-notifications/send-invoice', [ClientNotificationController::class, 'sendInvoice']);

    Route::get('/notifications',                  [ClientNotificationController::class, 'portalIndex']);
    Route::put('/notifications/{id}',             [ClientNotificationController::class, 'markAsRead']);

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
    });
});

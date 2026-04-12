<?php

use App\Http\Controllers\InventoryForecastController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Enums\Roles;


use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\PetSizeCategoryController;
use App\Http\Controllers\WeightRangeController;
use App\Http\Controllers\UnitOfMeasureController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\BreedController;
use App\Http\Controllers\VetScheduleController;
use App\Http\Controllers\PatientOwnerController;
use App\Http\Controllers\MedicalRecordController;
use App\Http\Controllers\CmsContentController;
use App\Http\Controllers\ClientNotificationController;
use App\Http\Controllers\NotificationTemplateController;

// ---------------------------------------------------------------------------
// Public routes (no authentication required)
// ---------------------------------------------------------------------------

Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/register', [AuthController::class, 'register'])->name('register');
Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('/password/reset', [AuthController::class, 'resetPassword']);
Route::get('/services/public', [ServiceController::class, 'index']);

/** Sync receiver (webhook from clinic) */
Route::post('/sync/receive', [\App\Http\Controllers\SyncController::class, 'receive']);

/** Health-check endpoint — intentionally public for monitoring tools. */
Route::get('/status', function () {
    try {
        \DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        $dbStatus = 'disconnected';
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
    Route::get('/dashboard/stats',                 [DashboardController::class, 'getStats']);
    Route::get('/dashboard/notifications',         [DashboardController::class, 'getNotifications']);
    Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
    Route::get('/dashboard/sales-forecast',        [DashboardController::class, 'getSalesForecast']);
    Route::get('/dashboard/inventory-forecast',    [DashboardController::class, 'getInventoryForecast']);
    Route::get('/dashboard/appointment-forecast',  [DashboardController::class, 'getAppointmentForecast']);

    // -----------------------------------------------------------------------
    // Core Modules
    // -----------------------------------------------------------------------
    Route::apiResource('appointments',    AppointmentController::class);

    // Inventory and Specialized Forecast
    Route::get('inventory/low-stock',     [InventoryController::class, 'lowStock']);
    Route::get('inventory/{inventory}/transactions', [InventoryController::class, 'transactions']);
    Route::post('inventory/{inventory}/accept-forecast', [InventoryController::class, 'acceptForecastRecommendation']);
    Route::get('inventory/{inventory}/forecast', [\App\Http\Controllers\InventoryForecastController::class, 'forecast']);
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
    Route::post('/settings', [SettingController::class, 'update']);

    // Content Management
    Route::apiResource('cms-content', CmsContentController::class);

    // -----------------------------------------------------------------------
    // User Management — Admin only
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . Roles::ADMIN->value], function () {
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });

    // -----------------------------------------------------------------------
    // Archive & Recovery — Admin only
    // -----------------------------------------------------------------------
    Route::group(['prefix' => 'archives', 'middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::get('/{type}', [\App\Http\Controllers\ArchiveController::class, 'index']);
        Route::post('/{type}/{id}/restore', [\App\Http\Controllers\ArchiveController::class, 'restore']);
        Route::delete('/{type}/{id}/force', [\App\Http\Controllers\ArchiveController::class, 'forceDelete']);
    });

    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {
        Route::get('/audit-logs', [\App\Http\Controllers\AuditLogController::class, 'index']);
        
        // Database Backup & Restore
        Route::get('/backups', [\App\Http\Controllers\BackupController::class, 'index']);
        Route::post('/backups', [\App\Http\Controllers\BackupController::class, 'create']);
        Route::post('/backups/restore', [\App\Http\Controllers\BackupController::class, 'restore']);
        Route::delete('/backups/{filename}', [\App\Http\Controllers\BackupController::class, 'destroy']);
        Route::get('/backups/download/{filename}', [\App\Http\Controllers\BackupController::class, 'download']);
    });

    // -----------------------------------------------------------------------
    // Specialized Reports — restricted to Admin only
    // -----------------------------------------------------------------------
    $reportRoles = Roles::adminRoles();
    Route::group(['prefix' => 'reports', 'middleware' => 'role:' . implode(',', $reportRoles)], function () {

        Route::get('/inventory/low-stock',            [\App\Http\Controllers\LowStockReportController::class, 'generate']);
        Route::get('/sales/revenue-summary',          [\App\Http\Controllers\SalesReportController::class, 'getRevenueSummary']);
        Route::get('/sales/top-services',             [\App\Http\Controllers\SalesReportController::class, 'getTopServices']);
        Route::get('/sales/transaction-volume',       [\App\Http\Controllers\SalesReportController::class, 'getTransactionVolume']);
        Route::get('/patients/species-distribution',  [\App\Http\Controllers\PatientReportController::class, 'getSpeciesDistribution']);
        Route::get('/patients/registration-trends',   [\App\Http\Controllers\PatientReportController::class, 'getRegistrationTrends']);
        Route::get('/patients/demographics',          [\App\Http\Controllers\PatientReportController::class, 'getDemographics']);
    });
});

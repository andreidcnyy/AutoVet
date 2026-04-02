<?php

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
use App\Http\Controllers\OwnerController;
use App\Http\Controllers\MedicalRecordController;
use App\Http\Controllers\CmsContentController;

// ---------------------------------------------------------------------------
// Public routes (no authentication required)
// ---------------------------------------------------------------------------

Route::post('/login', [AuthController::class, 'login'])->name('login');

/** Health-check endpoint — intentionally public for monitoring tools. */
Route::get('/status', function () {
    return response()->json([
        'status'    => 'success',
        'message'   => 'AutoVet Laravel API is up and running!',
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
    Route::get('/profile',  [ProfileController::class, 'show']);
    Route::put('/profile',  [ProfileController::class, 'update']);
    Route::get('/user',     function (Request $request) { return $request->user(); });

    // -----------------------------------------------------------------------
    // Inventory
    // -----------------------------------------------------------------------
    Route::get('/inventory',                            [InventoryController::class, 'index']);
    Route::get('/inventory/low-stock',                  [InventoryController::class, 'lowStock']);
    Route::get('/inventory/{inventory}/transactions',   [InventoryController::class, 'transactions']);
    Route::get('/inventory/{inventory}/transactions',   [InventoryController::class, 'transactions']);
    Route::put('/inventory/{inventory}',                [InventoryController::class, 'update']);
    
    // Inventory Write - Restricted to Clinic Management
    Route::post('/inventory', [InventoryController::class, 'store'])
         ->middleware('role:' . Roles::ADMIN->value . ',' . Roles::CHIEF_VET->value . ',' . Roles::STAFF->value);
         
    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])
         ->middleware('role:' . Roles::ADMIN->value . ',' . Roles::CHIEF_VET->value);


    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update'])
         ->middleware('role:' . Roles::ADMIN->value . ',' . Roles::CHIEF_VET->value);


    // -----------------------------------------------------------------------
    // Core Clinical & Administrative Resources
    // Restricted to Clinic Staff (Admin, Chief Vet, Vet, Staff)
    // -----------------------------------------------------------------------
    Route::group(['middleware' => 'role:' . implode(',', Roles::all())], function () {
        Route::get('/dashboard/stats',                [DashboardController::class, 'getStats']);
        Route::get('/dashboard/notifications',        [DashboardController::class, 'getNotifications']);
        Route::get('/dashboard/sales-forecast',       [DashboardController::class, 'getSalesForecast']);
        Route::get('/dashboard/inventory-consumption',[DashboardController::class, 'getInventoryConsumption']);
        Route::get('/dashboard/inventory-forecast',   [DashboardController::class, 'getInventoryForecast']);
        Route::get('/dashboard/appointment-forecast', [DashboardController::class, 'getAppointmentForecast']);

        Route::apiResource('appointments',    AppointmentController::class);

        Route::apiResource('invoices',        InvoiceController::class);
        Route::apiResource('services',        ServiceController::class);
        Route::apiResource('medical-records', MedicalRecordController::class);
        Route::apiResource('owners',          OwnerController::class);
        Route::apiResource('pets',            \App\Http\Controllers\PetController::class);
        Route::apiResource('vet-schedules',   VetScheduleController::class);
        Route::post('owners/import',          [OwnerController::class, 'import']);
    });


    // -----------------------------------------------------------------------
    // Master Data — Read access for all authenticated users
    // -----------------------------------------------------------------------
    Route::get('/inventory-categories', [\App\Http\Controllers\InventoryCategoryController::class, 'index']);
    Route::get('/service-categories',   [\App\Http\Controllers\ServiceCategoryController::class, 'index']);
    Route::get('/pet-size-categories',  [PetSizeCategoryController::class, 'index']);
    Route::get('/weight-ranges',        [WeightRangeController::class, 'index']);
    Route::get('/units-of-measure',     [UnitOfMeasureController::class, 'index']);
    Route::get('/species',              [SpeciesController::class, 'index']);
    Route::get('/breeds',               [BreedController::class, 'index']);

    // Master Data — Write access: Admin and Chief Veterinarian only
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {

        Route::apiResource('inventory-categories', \App\Http\Controllers\InventoryCategoryController::class)->except(['index']);
        Route::apiResource('service-categories',   \App\Http\Controllers\ServiceCategoryController::class)->except(['index']);
        Route::apiResource('pet-size-categories',  PetSizeCategoryController::class)->except(['index']);
        Route::apiResource('weight-ranges',        WeightRangeController::class)->except(['index']);
        Route::apiResource('units-of-measure',     UnitOfMeasureController::class)->except(['index']);
        Route::apiResource('species',              SpeciesController::class)->except(['index']);
        Route::apiResource('breeds',               BreedController::class)->except(['index']);
        Route::apiResource('users',                UserController::class);
    });

    // -----------------------------------------------------------------------
    // CMS Content (Website Content Management)
    // Read: all authenticated clinic users
    // Write: Admin and Chief Veterinarian only
    // -----------------------------------------------------------------------
    Route::get('/cms-contents',              [CmsContentController::class, 'index']);
    Route::get('/cms-contents/{cmsContent}', [CmsContentController::class, 'show']);
    Route::group(['middleware' => 'role:' . implode(',', Roles::adminRoles())], function () {

        Route::post('/cms-contents',                   [CmsContentController::class, 'store']);
        Route::put('/cms-contents/{cmsContent}',       [CmsContentController::class, 'update']);
        Route::delete('/cms-contents/{cmsContent}',    [CmsContentController::class, 'destroy']);
    });

    // -----------------------------------------------------------------------
    // Specialized Reports — restricted to clinical and admin roles
    // -----------------------------------------------------------------------
    $reportRoles = array_merge(Roles::adminRoles(), [Roles::VETERINARIAN->value]);
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

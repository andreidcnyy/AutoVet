<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/dashboard/sales-forecast', [DashboardController::class, 'getSalesForecast']);
Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
Route::get('/dashboard/notifications', [DashboardController::class, 'getNotifications']);
Route::get('/dashboard/inventory-forecast', [DashboardController::class, 'getInventoryForecast']);
Route::get('/dashboard/appointment-forecast', [DashboardController::class, 'getAppointmentForecast']);

// Specialized Reports protected by roles
Route::group(['prefix' => 'reports', 'middleware' => ['auth:sanctum', 'role:Admin,Chief Veterinarian,Veterinarian']], function () {
    Route::get('/inventory/low-stock', [\App\Http\Controllers\LowStockReportController::class, 'generate']);
    Route::get('/sales/revenue-summary', [\App\Http\Controllers\SalesReportController::class, 'getRevenueSummary']);
    Route::get('/sales/top-services', [\App\Http\Controllers\SalesReportController::class, 'getTopServices']);
    Route::get('/sales/transaction-volume', [\App\Http\Controllers\SalesReportController::class, 'getTransactionVolume']);
    Route::get('/patients/species-distribution', [\App\Http\Controllers\PatientReportController::class, 'getSpeciesDistribution']);
    Route::get('/patients/registration-trends', [\App\Http\Controllers\PatientReportController::class, 'getRegistrationTrends']);
    Route::get('/patients/demographics', [\App\Http\Controllers\PatientReportController::class, 'getDemographics']);
});

Route::group(['middleware' => ['auth:sanctum']], function() {
    Route::put('/inventory/{inventory}', [InventoryController::class, 'update']); 
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
    Route::post('/inventory', [InventoryController::class, 'store'])->middleware('role:Admin,Chief Veterinarian,Staff');
    Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy'])->middleware('role:Admin,Chief Veterinarian');
    Route::get('/inventory/{inventory}/transactions', [InventoryController::class, 'transactions']);

    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update'])->middleware('role:Admin,Chief Veterinarian');

    Route::apiResource('appointments', AppointmentController::class);
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('services', ServiceController::class);
    
    // Master Data Resources
    // Read access for all authenticated users
    Route::get('/inventory-categories', [App\Http\Controllers\InventoryCategoryController::class, 'index']);
    Route::get('/service-categories', [App\Http\Controllers\ServiceCategoryController::class, 'index']);
    Route::get('/pet-size-categories', [PetSizeCategoryController::class, 'index']);
    Route::get('/weight-ranges', [WeightRangeController::class, 'index']);
    Route::get('/units-of-measure', [UnitOfMeasureController::class, 'index']);
    Route::get('/species', [SpeciesController::class, 'index']);
    Route::get('/breeds', [BreedController::class, 'index']);

    // Write access for Admin/Chief Veterinarian
    Route::group(['middleware' => 'role:Admin,Chief Veterinarian'], function() {
        Route::apiResource('inventory-categories', App\Http\Controllers\InventoryCategoryController::class)->except(['index']);
        Route::apiResource('service-categories', App\Http\Controllers\ServiceCategoryController::class)->except(['index']);
        Route::apiResource('pet-size-categories', PetSizeCategoryController::class)->except(['index']);
        Route::apiResource('weight-ranges', WeightRangeController::class)->except(['index']);
        Route::apiResource('units-of-measure', UnitOfMeasureController::class)->except(['index']);
        Route::apiResource('species', SpeciesController::class)->except(['index']);
        Route::apiResource('breeds', BreedController::class)->except(['index']);
        Route::apiResource('users', UserController::class);
    });
    Route::apiResource('vet-schedules', VetScheduleController::class);
    Route::post('owners/import', [OwnerController::class, 'import']);
    Route::apiResource('owners', OwnerController::class);
    Route::apiResource('pets', \App\Http\Controllers\PetController::class);
});

Route::post('/login', [AuthController::class, 'login'])->name('login');

Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet Laravel API is up and running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});

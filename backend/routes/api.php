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

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/dashboard/sales-forecast', [DashboardController::class, 'getSalesForecast']);
Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
Route::get('/dashboard/inventory-consumption', [DashboardController::class, 'getInventoryConsumption']);
Route::get('/dashboard/notifications', [DashboardController::class, 'getNotifications']);
Route::get('/dashboard/inventory-forecast', [DashboardController::class, 'getInventoryForecast']);
Route::get('/dashboard/appointment-forecast', [DashboardController::class, 'getAppointmentForecast']);

Route::put('/inventory/{inventory}', [InventoryController::class, 'update']); //edit in modal
Route::get('/profile', [ProfileController::class, 'show']);
Route::put('/profile', [ProfileController::class, 'update']);

Route::get('/inventory', [InventoryController::class, 'index']);
Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
Route::get('/reports/inventory/low-stock', [\App\Http\Controllers\LowStockReportController::class, 'generate']);
Route::post('/inventory', [InventoryController::class, 'store']);
Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);
Route::get('/inventory/{inventory}/transactions', [InventoryController::class, 'transactions']);

Route::get('/settings', [SettingController::class, 'index']);
Route::put('/settings', [SettingController::class, 'update']);

Route::apiResource('appointments', AppointmentController::class);
Route::apiResource('invoices', InvoiceController::class);
Route::apiResource('services', ServiceController::class);
Route::apiResource('users', UserController::class);

Route::apiResource('inventory-categories', \App\Http\Controllers\InventoryCategoryController::class);
Route::apiResource('service-categories', \App\Http\Controllers\ServiceCategoryController::class);
Route::apiResource('pet-size-categories', \App\Http\Controllers\PetSizeCategoryController::class);
Route::apiResource('weight-ranges', \App\Http\Controllers\WeightRangeController::class);
Route::apiResource('units-of-measure', \App\Http\Controllers\UnitOfMeasureController::class);
Route::apiResource('species', \App\Http\Controllers\SpeciesController::class);
Route::apiResource('breeds', \App\Http\Controllers\BreedController::class);
Route::apiResource('owners', \App\Http\Controllers\OwnerController::class);
Route::apiResource('pets', \App\Http\Controllers\PetController::class);
Route::apiResource('vet-schedules', \App\Http\Controllers\VetScheduleController::class);
Route::apiResource('medical-records', \App\Http\Controllers\MedicalRecordController::class);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet Laravel API is up and running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});

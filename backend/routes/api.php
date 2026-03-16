<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\PatientController;
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

Route::put('/inventory/{inventory}', [InventoryController::class, 'update']); //edit in modal
Route::get('/profile', [ProfileController::class, 'show']);
Route::put('/profile', [ProfileController::class, 'update']);

Route::get('/inventory', [InventoryController::class, 'index']);
Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
Route::get('/reports/inventory/low-stock', [\App\Http\Controllers\LowStockReportController::class, 'generate']);
Route::post('/inventory', [InventoryController::class, 'store']);
Route::delete('/inventory/{inventory}', [InventoryController::class, 'destroy']);

Route::get('/patients', [PatientController::class, 'index']);
Route::get('/patients/{patient}', [PatientController::class, 'show']);
Route::post('/patients', [PatientController::class, 'store']);
Route::put('/patients/{patient}', [PatientController::class, 'update']);
Route::delete('/patients/{patient}', [PatientController::class, 'destroy']);

Route::get('/settings', [SettingController::class, 'index']);
Route::put('/settings', [SettingController::class, 'update']);

Route::apiResource('appointments', AppointmentController::class);
Route::apiResource('invoices', InvoiceController::class);
Route::apiResource('services', ServiceController::class);
Route::apiResource('users', UserController::class);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/status', function () {
    return response()->json([
        'status' => 'success',
        'message' => 'AutoVet Laravel API is up and running!',
        'timestamp' => now()->toIso8601String(),
    ]);
});

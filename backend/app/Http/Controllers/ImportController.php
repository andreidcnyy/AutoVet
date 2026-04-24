<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\Inventory;
use App\Models\InventoryUsageHistory;
use App\Models\Service;
use App\Models\Owner;
use App\Models\Pet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ImportController extends Controller
{
    /**
     * Import Appointments from CSV
     */
    public function importAppointments(Request $request)
    {
        return $this->processImport($request, 'appointments', [
            'pet_id' => 'required|exists:pets,id',
            'service_id' => 'required|exists:services,id',
            'date' => 'required|date',
            'status' => 'required|string|in:pending,approved,completed,cancelled,declined',
        ], function($row) {
            return Appointment::create($row);
        });
    }

    /**
     * Import Invoices from CSV
     */
    public function importInvoices(Request $request)
    {
        return $this->processImport($request, 'invoices', [
            'pet_id' => 'required|exists:pets,id',
            'total' => 'required|numeric',
            'status' => 'required|string|in:Draft,Finalized,Paid,Partially Paid,Cancelled',
            'created_at' => 'required|date',
        ], function($row) {
            return Invoice::create($row);
        });
    }

    /**
     * Import Inventory Usage from CSV
     */
    public function importInventoryUsage(Request $request)
    {
        return $this->processImport($request, 'inventory_usage', [
            'inventory_id' => 'required|exists:inventories,id',
            'quantity' => 'required|numeric',
            'transaction_type' => 'required|string',
            'created_at' => 'required|date',
        ], function($row) {
            $inventory = Inventory::find($row['inventory_id']);
            $oldStock = $inventory->stock_level;
            $newStock = $oldStock + $row['quantity'];
            
            $usage = InventoryUsageHistory::create(array_merge($row, [
                'old_stock' => $oldStock,
                'new_stock' => $newStock
            ]));

            $inventory->update(['stock_level' => $newStock]);
            return $usage;
        });
    }

    /**
     * Import Services from CSV
     */
    public function importServices(Request $request)
    {
        return $this->processImport($request, 'services', [
            'name' => 'required|string',
            'category' => 'required|string',
            'price' => 'required|numeric',
            'status' => 'required|string|in:Active,Inactive',
        ], function($row) {
            return Service::create($row);
        });
    }

    /**
     * Import Owners from CSV
     */
    public function importOwners(Request $request)
    {
        return $this->processImport($request, 'owners', [
            'name' => 'required|string',
            'phone' => 'required|string',
            'email' => 'nullable|email',
        ], function($row) {
            return Owner::firstOrCreate(['phone' => $row['phone']], $row);
        });
    }

    /**
     * Generic CSV processing logic
     */
    private function processImport(Request $request, $type, $rules, $createCallback)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);
        
        if (!$header) {
            return response()->json(['message' => 'Invalid CSV format.'], 400);
        }

        $importedCount = 0;
        $errors = [];
        $rowNumber = 1;

        DB::beginTransaction();
        try {
            while (($data = fgetcsv($handle)) !== FALSE) {
                $rowNumber++;
                $row = array_combine($header, $data);
                
                $validator = Validator::make($row, $rules);
                if ($validator->fails()) {
                    $errors[] = "Row {$rowNumber}: " . implode(', ', $validator->errors()->all());
                    continue;
                }

                $createCallback($row);
                $importedCount++;
            }

            if (count($errors) > 0 && $importedCount == 0) {
                DB::rollBack();
                return response()->json([
                    'message' => 'Import failed with validation errors.',
                    'errors' => $errors
                ], 422);
            }

            DB::commit();
            return response()->json([
                'message' => "Successfully imported {$importedCount} records.",
                'warning_count' => count($errors),
                'warnings' => array_slice($errors, 0, 10)
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("Import Error ({$type}): " . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred during import.',
                'error' => $e->getMessage()
            ], 500);
        } finally {
            fclose($handle);
        }
    }
}

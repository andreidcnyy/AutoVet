<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use ZipArchive;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'db:backup';
    protected $description = 'Backup key clinic data as CSV files inside a ZIP archive';

    // Tables to include in the backup
    private const TABLES = [
        'clinics',
        'users',
        'patients',
        'patient_owners',
        'appointments',
        'services',
        'invoices',
        'invoice_items',
        'medical_records',
        'notification_templates',
    ];

    public function handle()
    {
        $backupPath = storage_path('app/backups');
        if (!is_dir($backupPath)) {
            mkdir($backupPath, 0755, true);
        }

        $filename = 'backup_' . date('Y_m_d_H_i_s') . '.zip';
        $fullPath = $backupPath . '/' . $filename;

        $zip = new ZipArchive();
        if ($zip->open($fullPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            $this->error("Failed to create ZIP archive at: {$fullPath}");
            return 1;
        }

        $this->info("Creating CSV backup...");

        foreach (self::TABLES as $table) {
            try {
                $rows = DB::table($table)->get();

                if ($rows->isEmpty()) {
                    // Write header-only CSV so the file still appears in the ZIP
                    $columns = DB::getSchemaBuilder()->getColumnListing($table);
                    $csv = implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n";
                } else {
                    $columns = array_keys((array) $rows->first());
                    $csv = implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n";
                    foreach ($rows as $row) {
                        $values = array_map(function ($v) {
                            if ($v === null) return '';
                            $v = str_replace('"', '""', $v);
                            return '"' . $v . '"';
                        }, (array) $row);
                        $csv .= implode(',', $values) . "\n";
                    }
                }

                $zip->addFromString("{$table}.csv", $csv);
                $this->info("  + {$table}.csv (" . $rows->count() . " rows)");
            } catch (\Exception $e) {
                $this->warn("  ! Skipped {$table}: " . $e->getMessage());
            }
        }

        $zip->close();
        $this->info("Backup successfully created at: {$fullPath}");
        return 0;
    }
}

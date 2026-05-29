<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'db:backup';
    protected $description = 'Backup key clinic data as CSV files inside a tar.gz archive';

    private const TABLES = [
        'clinics',
        // Accounts (the old `users` table was dropped — auth lives in these two)
        'admins',
        'portal_users',
        // Clients & patients (models default to `owners` / `pets`, not the
        // legacy `patient_owners` / `patients` tables)
        'owners',
        'species',
        'breeds',
        'pets',
        // Scheduling & visits
        'vet_schedules',
        'appointments',
        'appointment_services',
        // Services & billing
        'services',
        'service_prices',
        'invoices',
        'invoice_items',
        'medical_records',
        // Inventory
        'inventories',
        'inventory_transactions',
        // Communications & misc
        'notification_templates',
        'client_notifications',
        'reviews',
        'settings',
    ];

    public function handle()
    {
        $backupPath = storage_path('app/backups');
        if (!is_dir($backupPath)) {
            mkdir($backupPath, 0755, true);
        }

        $basename = 'backup_' . date('Y_m_d_H_i_s');
        $tarPath  = $backupPath . '/' . $basename . '.tar';
        $gzPath   = $tarPath . '.gz';

        $this->info("Creating CSV backup...");

        try {
            $phar = new \PharData($tarPath);

            foreach (self::TABLES as $table) {
                try {
                    $rows = DB::table($table)->get();

                    if ($rows->isEmpty()) {
                        $columns = DB::connection()->getSchemaBuilder()->getColumnListing($table);
                        $csv = implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n";
                    } else {
                        $columns = array_keys((array) $rows->first());
                        $csv = implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n";
                        foreach ($rows as $row) {
                            $values = array_map(function ($v) {
                                if ($v === null) return '';
                                $v = str_replace('"', '""', (string) $v);
                                return '"' . $v . '"';
                            }, (array) $row);
                            $csv .= implode(',', $values) . "\n";
                        }
                    }

                    $phar->addFromString("{$table}.csv", $csv);
                    $this->info("  + {$table}.csv (" . $rows->count() . " rows)");
                } catch (\Exception $e) {
                    $this->warn("  ! Skipped {$table}: " . $e->getMessage());
                }
            }

            $phar->compress(\Phar::GZ);
            unlink($tarPath);
        } catch (\Throwable $e) {
            if (file_exists($tarPath)) unlink($tarPath);
            $this->error("Failed to create backup: " . $e->getMessage());
            return 1;
        }

        $this->info("Backup successfully created: {$basename}.tar.gz");
        return 0;
    }
}

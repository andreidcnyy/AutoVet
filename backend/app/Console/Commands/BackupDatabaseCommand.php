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

    /**
     * Internal / technical / sensitive columns to leave out of the CSVs so the
     * spreadsheets only show meaningful, human-readable data.
     */
    private const EXCLUDE_COLUMNS = [
        'password',
        'remember_token',
        'must_change_password',
        'email_verified_at',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'google_id',
        'fcm_token',
        'avatar',                    // base64 blob — unreadable in a spreadsheet
        'uuid',
        'sync_status',
        'synced_at',
        'last_synced_at',
        'last_modified_locally_at',
        'clinic_id',
        'updated_at',
        'deleted_at',
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

                    // Determine which columns to keep (drop internal/technical ones)
                    $allColumns = $rows->isEmpty()
                        ? DB::connection()->getSchemaBuilder()->getColumnListing($table)
                        : array_keys((array) $rows->first());
                    $columns = array_values(array_filter(
                        $allColumns,
                        fn($c) => !in_array(strtolower($c), self::EXCLUDE_COLUMNS, true)
                    ));

                    $csv = implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n";
                    foreach ($rows as $row) {
                        $row = (array) $row;
                        $values = array_map(function ($c) use ($row) {
                            $v = $row[$c] ?? null;
                            if ($v === null) return '';
                            return '"' . str_replace('"', '""', (string) $v) . '"';
                        }, $columns);
                        $csv .= implode(',', $values) . "\n";
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

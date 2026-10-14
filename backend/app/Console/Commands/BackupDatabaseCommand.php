<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'db:backup {--clinic= : Export only the rows that belong to this clinic}';
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

    /**
     * Tables that carry no clinic_id of their own, keyed to the parent that
     * does: [foreign key, parent table]. A clinic-only backup keeps a child
     * row when its parent belongs to the clinic.
     */
    private const CHILD_TABLES = [
        'appointment_services'   => ['appointment_id', 'appointments'],
        'service_prices'         => ['service_id', 'services'],
        'invoice_items'          => ['invoice_id', 'invoices'],
        'inventory_transactions' => ['inventory_id', 'inventories'],
    ];

    /** Where backups for one clinic (or, with null, the whole platform) are kept. */
    public static function directoryFor(?int $clinicId): string
    {
        return $clinicId
            ? storage_path("app/backups/clinic_{$clinicId}")
            : storage_path('app/backups');
    }

    public function handle()
    {
        $clinicId = $this->option('clinic') !== null ? (int) $this->option('clinic') : null;
        $backupPath = self::directoryFor($clinicId);
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
                $tmp = null;
                try {
                    // Determine which columns to keep (drop internal/technical ones)
                    $columns = array_values(array_filter(
                        DB::connection()->getSchemaBuilder()->getColumnListing($table),
                        fn($c) => !in_array(strtolower($c), self::EXCLUDE_COLUMNS, true)
                    ));

                    if (empty($columns)) {
                        $this->warn("  ! Skipped {$table}: no exportable columns");
                        continue;
                    }

                    // Stream rows straight to a temp file instead of buffering the
                    // whole table (and the whole CSV string) in memory. Selecting
                    // only the kept columns also keeps excluded blobs such as
                    // `avatar` off the wire entirely — this runs against a remote
                    // database in production, where both matter.
                    $tmp = tempnam(sys_get_temp_dir(), 'bk_');
                    $fh  = fopen($tmp, 'w');
                    fwrite($fh, implode(',', array_map(fn($c) => '"' . $c . '"', $columns)) . "\n");

                    $query = $this->scopedQuery($table, $clinicId);
                    if ($query === null) {
                        fclose($fh);
                        $this->warn("  ! Skipped {$table}: cannot tell which clinic its rows belong to");
                        continue;
                    }

                    $count = 0;
                    foreach ($query->select($columns)->cursor() as $row) {
                        $row = (array) $row;
                        $values = array_map(function ($c) use ($row) {
                            $v = $row[$c] ?? null;
                            if ($v === null) return '';
                            $v = (string) $v;
                            // A cell starting with = + - @ is run as a formula
                            // when the CSV is opened in a spreadsheet, and
                            // these cells hold client-typed text.
                            if ($v !== '' && in_array($v[0], ['=', '+', '-', '@'], true) && !is_numeric($v)) {
                                $v = "'" . $v;
                            }
                            return '"' . str_replace('"', '""', $v) . '"';
                        }, $columns);
                        fwrite($fh, implode(',', $values) . "\n");
                        $count++;
                    }
                    fclose($fh);

                    $phar->addFile($tmp, "{$table}.csv");
                    $this->info("  + {$table}.csv ({$count} rows)");
                } catch (\Exception $e) {
                    $this->warn("  ! Skipped {$table}: " . $e->getMessage());
                } finally {
                    if ($tmp !== null && file_exists($tmp)) unlink($tmp);
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

    /**
     * The rows of $table to export, limited to $clinicId when one is given.
     * Returns null when the table has no way to tell which clinic a row
     * belongs to, so a clinic-only backup leaves it out rather than leaking
     * every clinic's rows into it.
     */
    private function scopedQuery(string $table, ?int $clinicId): ?\Illuminate\Database\Query\Builder
    {
        $query = DB::table($table);
        if ($clinicId === null) {
            return $query;
        }

        if ($table === 'clinics') {
            return $query->where('id', $clinicId);
        }

        $schema = DB::connection()->getSchemaBuilder();
        if ($schema->hasColumn($table, 'clinic_id')) {
            return $query->where('clinic_id', $clinicId);
        }

        if (isset(self::CHILD_TABLES[$table])) {
            [$foreignKey, $parent] = self::CHILD_TABLES[$table];
            if ($schema->hasColumn($parent, 'clinic_id')) {
                return $query->whereIn($foreignKey, DB::table($parent)->select('id')->where('clinic_id', $clinicId));
            }
        }

        return null;
    }
}

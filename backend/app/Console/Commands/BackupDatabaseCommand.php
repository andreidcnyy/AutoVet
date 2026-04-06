<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BackupDatabaseCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:backup';
    protected $description = 'Backup the database using mysqldump';

    public function handle()
    {
        $backupPath = storage_path('app/backups');
        if (!is_dir($backupPath)) {
            mkdir($backupPath, 0755, true);
        }

        $filename = 'backup_' . date('Y_m_d_H_i_s') . '.sql';
        $fullPath = $backupPath . '/' . $filename;

        $dbHost = config('database.connections.mysql.host');
        $dbPort = config('database.connections.mysql.port');
        $dbName = config('database.connections.mysql.database');
        $dbUser = config('database.connections.mysql.username');
        $dbPass = config('database.connections.mysql.password');

        // Look for XAMPP path first
        $mysqldumpPath = 'mysqldump';
        if (file_exists('C:\\xampp\\mysql\\bin\\mysqldump.exe')) {
            $mysqldumpPath = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
        }

        $passwordArg = $dbPass ? "--password={$dbPass}" : "";
        $command = "{$mysqldumpPath} --host={$dbHost} --port={$dbPort} --user={$dbUser} {$passwordArg} {$dbName} > \"{$fullPath}\"";

        $this->info("Creating backup...");
        
        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        if ($returnVar === 0) {
            $this->info("Backup successfully created at: {$fullPath}");
        } else {
            $this->error("Backup failed.");
        }
    }
}

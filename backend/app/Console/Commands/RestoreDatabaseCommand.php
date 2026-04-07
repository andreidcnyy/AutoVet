<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class RestoreDatabaseCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:restore {file}';
    protected $description = 'Restore the database using mysql command';

    public function handle()
    {
        $filename = $this->argument('file');
        
        // If it's a relative path just in the backups folder, prepend the backups path
        if (strpos($filename, '\\') === false && strpos($filename, '/') === false) {
            $fullPath = storage_path('app/backups/' . $filename);
        } else {
            $fullPath = $filename;
        }

        if (!file_exists($fullPath)) {
            $this->error("Backup file not found at: {$fullPath}");
            return;
        }

        $dbHost = config('database.connections.mysql.host');
        $dbPort = config('database.connections.mysql.port');
        $dbName = config('database.connections.mysql.database');
        $dbUser = config('database.connections.mysql.username');
        $dbPass = config('database.connections.mysql.password');

        // Look for XAMPP path first
        $mysqlPath = 'mysql';
        if (file_exists('C:\\xampp\\mysql\\bin\\mysql.exe')) {
            $mysqlPath = 'C:\\xampp\\mysql\\bin\\mysql.exe';
        }

        $passwordArg = $dbPass ? "--password={$dbPass}" : "";
        $command = "{$mysqlPath} --host={$dbHost} --port={$dbPort} --user={$dbUser} {$passwordArg} {$dbName} < \"{$fullPath}\"";

        $this->info("Restoring backup from {$fullPath}...");
        
        $output = [];
        $returnVar = 0;
        exec($command, $output, $returnVar);

        if ($returnVar === 0) {
            $this->info("Backup successfully restored.");
        } else {
            $this->error("Restore failed.");
        }
    }
}

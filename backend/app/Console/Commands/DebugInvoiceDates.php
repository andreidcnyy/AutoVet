<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DebugInvoiceDates extends Command
{
    protected $signature = 'debug:invoice-dates';
    protected $description = 'Check distribution of invoice dates';

    public function handle()
    {
        $counts = DB::table('invoices')
            ->select(DB::raw("YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as count"))
            ->groupBy('year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->get();

        $this->info("Invoice Date Distribution:");
        foreach ($counts as $row) {
            $this->line("Year: {$row->year}, Month: {$row->month}, Count: {$row->count}");
        }
    }
}

<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Appointment;
use App\Models\Service;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EnrichAppointments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'autovet:enrich-appointments {--dry-run : Only show the report without updating the database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Analyze and fix historical appointment data for AI Service Forecast readiness.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        $this->info($dryRun ? "Starting DRY RUN enrichment audit..." : "Starting historical data enrichment...");

        $appointments = Appointment::whereNull('service_id')->get();
        $totalScanned = $appointments->count();
        
        if ($totalScanned === 0) {
            $this->info("No uncategorized appointments found.");
            return 0;
        }

        $stats = [
            'total' => $totalScanned,
            'mapped' => 0,
            'uncertain' => 0,
            'categories' => [
                'Consultation' => 0,
                'Vaccination' => 0,
                'Grooming' => 0,
                'Laboratory' => 0,
                'Other' => 0
            ]
        ];

        $uncertainRecords = [];

        // 1. Fetch Target Service IDs (Cache them)
        $services = Service::all(['id', 'name', 'category']);
        $categoryMap = [];
        foreach ($services as $service) {
            $categoryMap[strtolower($service->category)][] = $service;
        }

        foreach ($appointments as $appointment) {
            $targetServiceId = null;
            $targetCategory = null;
            $inferenceMethod = 'none';

            // Tier 1: Linked Invoice Logic
            $invoice = Invoice::where('appointment_id', $appointment->id)->with('items')->first();
            if ($invoice && $invoice->items->count() > 0) {
                // Look for the first service item
                $serviceItem = $invoice->items->where('item_type', 'service')->first();
                if ($serviceItem && $serviceItem->service_id) {
                    $targetServiceId = $serviceItem->service_id;
                    $inferenceMethod = 'invoice';
                }
            }

            // Tier 2: Keyword Matching (if Tier 1 failed)
            if (!$targetServiceId) {
                $category = $this->inferCategory($appointment->title . ' ' . $appointment->notes);
                if ($category) {
                    $targetCategory = $category;
                    // Find a suitable service for this category
                    $match = $this->findBestServiceMatch($category, $appointment->title, $categoryMap);
                    if ($match) {
                        $targetServiceId = $match->id;
                        $inferenceMethod = 'keyword';
                    }
                }
            }

            if ($targetServiceId) {
                $stats['mapped']++;
                $service = Service::find($targetServiceId);
                $stats['categories'][$service->category ?? 'Other']++;
                
                if (!$dryRun) {
                    $appointment->update([
                        'service_id' => $targetServiceId,
                        'category' => $service->category
                    ]);
                }
            } else {
                $stats['uncertain']++;
                $uncertainRecords[] = [
                    'id' => $appointment->id,
                    'title' => $appointment->title,
                    'notes' => Str::limit($appointment->notes, 30)
                ];
            }
        }

        // Output Report
        $this->info("\n--- ENRICHMENT REPORT ---");
        $this->table(['Metric', 'Count'], [
            ['Total Scanned', $stats['total']],
            ['Successfully Mapped', $stats['mapped']],
            ['Uncertain / Needs Review', $stats['uncertain']]
        ]);

        $this->info("\n--- MAPPING BY CATEGORY ---");
        $tableData = [];
        foreach ($stats['categories'] as $cat => $count) {
            $tableData[] = [$cat, $count];
        }
        $this->table(['Category', 'Estimated Count'], $tableData);

        if ($stats['uncertain'] > 0) {
            $this->warn("\nRecords Needing Manual Review:");
            $this->table(['ID', 'Title', 'Notes'], $uncertainRecords);
        }

        if ($dryRun) {
            $this->info("\nDry run complete. No database changes were made.");
        } else {
            $this->info("\nEnrichment complete. Database updated.");
        }

        return 0;
    }

    private function inferCategory($text)
    {
        $text = strtolower($text);

        // Laboratory (Specific phrases first)
        $labPhrases = [
            'complete blood count', 'comprehensive blood test', 'hormonal test', 
            'test kit', 'blood chemistry', 'blood test', 'fecalysis', 'urinalysis'
        ];
        foreach ($labPhrases as $phrase) {
            if (str_contains($text, $phrase)) return 'Laboratory';
        }
        if (str_contains($text, 'cbc') || str_contains($text, 'lab') || str_contains($text, 'laboratory')) {
            return 'Laboratory';
        }

        // Vaccination (with Normalization)
        $vaccPatterns = ['5in1', '5-in-1', '5 in 1', '6in1', '6 in 1', '6-in-1', '4in1', '4-in-1', '4 in 1'];
        foreach ($vaccPatterns as $pattern) {
            if (str_contains(str_replace([' ', '-'], '', $text), str_replace([' ', '-'], '', $pattern))) {
                return 'Vaccination';
            }
        }
        $vaccKeywords = ['vaccine', 'vaccination', 'vaxx', 'shot', 'rabies', 'deworm'];
        foreach ($vaccKeywords as $kw) {
            if (str_contains($text, $kw)) return 'Vaccination';
        }

        // Grooming
        $groomKeywords = ['bath', 'haircut', 'trim', 'spa', 'grooming', 'groom'];
        foreach ($groomKeywords as $kw) {
            if (str_contains($text, $kw)) return 'Grooming';
        }

        // Consultation
        $consultKeywords = ['checkup', 'follow-up', 'consult', 'check', 'visit'];
        foreach ($consultKeywords as $kw) {
            if (str_contains($text, $kw)) return 'Consultation';
        }

        return null;
    }

    private function findBestServiceMatch($category, $title, $categoryMap)
    {
        $catKey = strtolower($category);
        if (!isset($categoryMap[$catKey])) return null;

        $servicesInCat = $categoryMap[$catKey];
        
        // Exact name match
        foreach ($servicesInCat as $s) {
            if (stripos($title, $s->name) !== false) return $s;
        }

        // Default to first match or a generic one if exists
        foreach ($servicesInCat as $s) {
            if (stripos($s->name, 'general') !== false) return $s;
        }

        return $servicesInCat[0];
    }
}

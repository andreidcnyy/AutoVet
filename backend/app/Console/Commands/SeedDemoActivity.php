<?php

namespace App\Console\Commands;

use App\Console\Concerns\LoadsLiveConnection;
use App\Support\ForecastMetrics;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Fills a quiet period with clinic activity — paid invoices, the completed
 * appointment behind each one, and new clients with their pets — so the
 * dashboard and analytics can be demonstrated.
 *
 * Built from the clinic's own records, not made up:
 *
 *   Invoices per day   N_t ~ Poisson(λ · w_weekday)
 *                      λ = invoices in the reference period / its days,
 *                      w = invoices on that weekday / average per weekday.
 *   Invoice contents   a real invoice from the reference period picked at
 *                      random (bootstrap): its lines, quantities, prices and
 *                      totals are copied, so the mix of services and products
 *                      and the ticket sizes match the real ones.
 *   New clients/day    C_t ~ Poisson(c), c = new clients per day in
 *                      --client-ref-from..--client-ref-to; each gets a pet
 *                      whose species, breed, size, sex and age are copied
 *                      from a random existing pet. Names, phones and
 *                      @example.com emails are fictional.
 *
 * Generated invoices go only to pets of clients without a portal account
 * (demo clients) and to the generated pets, never to real portal users.
 * A day is filled only in weeks whose real invoices are below
 * --gap-threshold of the expected count. Every generated row carries
 * --batch in synthetic_batch; --purge removes them all. Stock is not
 * deducted (stock_deducted = 1) and inventory usage history is not touched.
 */
class SeedDemoActivity extends Command
{
    use LoadsLiveConnection;

    protected $signature = 'demo:seed-activity
        {--live : Write to the production database (backend/.env.live)}
        {--from=2026-05-01 : First day that may be filled}
        {--to= : Last day that may be filled (default: yesterday)}
        {--ref-from=2026-02-01 : Start of the reference period for invoices}
        {--ref-to=2026-04-30 : End of the reference period for invoices}
        {--client-ref-from=2025-06-01 : Start of the reference period for new clients}
        {--client-ref-to=2026-03-31 : End of the reference period for new clients}
        {--seed=20261016 : Random seed (same seed = same rows)}
        {--batch=synthetic-2026-10 : Label stored on every generated row}
        {--gap-threshold=0.5 : Fill a week when its real invoices are below this share of the expected count}
        {--dry-run : Calculate and report, but write nothing}
        {--purge : Delete the rows of --batch instead of generating}
        {--report= : Write the parameters and results as JSON to this path}';

    protected $description = 'Fill a quiet period with invoices, appointments and new clients learned from real records';

    private const TABLES = ['invoices', 'appointments', 'owners', 'pets'];
    private const CLINIC_TZ = 'Asia/Manila';

    private const FIRST_NAMES = ['Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'John Paul', 'Angelica', 'Miguel', 'Camille',
        'Paolo', 'Bea', 'Carlo', 'Nicole', 'Rafael', 'Patricia', 'Gabriel', 'Andrea', 'Joshua', 'Katrina', 'Daniel', 'Jasmine',
        'Christian', 'Erika', 'Adrian', 'Danica', 'Kevin', 'Joanna', 'Ramon', 'Liza', 'Bryan', 'Shiela', 'Francis', 'Janine',
        'Vincent', 'Aileen', 'Renz', 'Trisha', 'Nathaniel', 'Pauline'];
    private const LAST_NAMES = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Tomas', 'Andrada',
        'Castillo', 'Flores', 'Villanueva', 'Ramos', 'Castro', 'Rivera', 'Aquino', 'Navarro', 'Salazar', 'Mercado', 'Domingo',
        'Gonzales', 'Lopez', 'Hernandez', 'Dela Cruz', 'Del Rosario', 'Pascual', 'Soriano', 'Valdez', 'Manalo', 'Aguilar', 'Marquez'];
    private const PET_NAMES = ['Bantay', 'Choco', 'Brownie', 'Mochi', 'Coco', 'Max', 'Luna', 'Bella', 'Milo', 'Snow', 'Peanut',
        'Kitkat', 'Oreo', 'Tiger', 'Shadow', 'Princess', 'Buddy', 'Lucky', 'Ginger', 'Muning', 'Whitey', 'Blackie', 'Cookie',
        'Pepper', 'Sushi', 'Toffee', 'Biscuit', 'Nala', 'Simba', 'Chowchow', 'Hachi', 'Yuki', 'Mango', 'Bruno', 'Ash'];
    private const STREETS = ['Rizal St.', 'Mabini St.', 'Bonifacio Ave.', 'Luna St.', 'Del Pilar St.', 'Aguinaldo St.',
        'Quezon Ave.', 'Burgos St.', 'Jacinto St.', 'Magsaysay Blvd.', 'Roxas St.', 'Osmena St.'];
    private const CITIES = [['Quezon City', 'Metro Manila', '1100'], ['Marikina', 'Metro Manila', '1800'], ['San Juan', 'Metro Manila', '1500'],
        ['Manila', 'Metro Manila', '1000'], ['Makati City', 'Metro Manila', '1200'], ['Pasig', 'Metro Manila', '1600'],
        ['Mandaluyong', 'Metro Manila', '1550'], ['Caloocan', 'Metro Manila', '1400'], ['San Jose del Monte City', 'Bulacan', '3023'],
        ['Antipolo', 'Rizal', '1870'], ['Cainta', 'Rizal', '1900']];

    private int $randState;

    public function handle(): int
    {
        $connection = 'mysql';
        if ($this->option('live')) {
            if (!$this->loadLiveEnv()) {
                $this->explainMissingLiveConfig();
                return self::FAILURE;
            }
            $connection = 'live';
        }
        $db = DB::connection($connection);
        $schema = Schema::connection($connection);

        foreach (self::TABLES as $table) {
            if (!$schema->hasColumn($table, 'synthetic_batch')) {
                $this->error("{$table}.synthetic_batch is missing. Run the migrations on this database first.");
                return self::FAILURE;
            }
        }

        $batch = (string) $this->option('batch');
        if ($this->option('purge')) {
            return $this->purge($db, $connection, $batch);
        }

        $tz = config('app.timezone') ?: 'UTC';
        $from = CarbonImmutable::parse($this->option('from'))->startOfDay();
        $to = $this->option('to') ? CarbonImmutable::parse($this->option('to'))->startOfDay() : CarbonImmutable::yesterday();
        $refFrom = CarbonImmutable::parse($this->option('ref-from'))->startOfDay();
        $refTo = CarbonImmutable::parse($this->option('ref-to'))->startOfDay();
        $cFrom = CarbonImmutable::parse($this->option('client-ref-from'))->startOfDay();
        $cTo = CarbonImmutable::parse($this->option('client-ref-to'))->startOfDay();
        $this->randState = (int) $this->option('seed');

        $clinicId = (int) ($db->table('clinics')->orderBy('id')->value('id') ?? 1);

        // ------------------------------------------------------- parameters
        $refDays = $refFrom->diffInDays($refTo) + 1;
        $refWhere = fn ($q) => $q->whereNull('synthetic_batch')
            ->whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
            ->whereBetween('created_at', [$refFrom->toDateTimeString(), $refTo->endOfDay()->toDateTimeString()]);

        $refInvoices = $db->table('invoices')->where($refWhere)
            ->get(['id', 'report_type', 'subtotal', 'discount_type', 'discount_value', 'tax_rate', 'total', 'payment_method']);
        if ($refInvoices->isEmpty()) {
            $this->error('No finalized invoices in the reference period.');
            return self::FAILURE;
        }
        $lambda = $refInvoices->count() / $refDays;

        $refItems = $db->table('invoice_items')->whereIn('invoice_id', $refInvoices->pluck('id'))
            ->orderBy('id')->get(['invoice_id', 'item_type', 'service_id', 'inventory_id', 'name', 'notes', 'qty', 'unit_price', 'amount', 'is_hidden'])
            ->groupBy('invoice_id');
        $refInvoices = $refInvoices->filter(fn ($i) => isset($refItems[$i->id]))->values();

        $byWeekday = $db->table('invoices')->where($refWhere)
            ->selectRaw('DAYOFWEEK(created_at) AS dow, COUNT(*) AS n')->groupBy('dow')->pluck('n', 'dow')->map(fn ($v) => (int) $v);
        $avg = $byWeekday->count() === 7 ? $byWeekday->avg() : null;
        $weights = [];
        foreach (range(1, 7) as $d) {
            $weights[$d] = $avg ? $byWeekday[$d] / $avg : 1.0;
        }

        $cDays = $cFrom->diffInDays($cTo) + 1;
        $newClients = $db->table('owners')->whereNull('synthetic_batch')
            ->whereBetween('created_at', [$cFrom->toDateTimeString(), $cTo->endOfDay()->toDateTimeString()])->count();
        $clientRate = $newClients / $cDays;

        // Appointment category per service, as real appointments record it.
        $serviceInfo = $db->table('appointments')->whereNull('synthetic_batch')->whereNotNull('service_id')
            ->selectRaw('service_id, MIN(category) AS category')->groupBy('service_id')
            ->get()->keyBy('service_id');

        // Pets that may receive generated invoices: those of clients without a portal account.
        $demoPets = $db->table('pets as p')->join('owners as o', 'o.id', '=', 'p.owner_id')
            ->whereNull('p.deleted_at')->whereNull('o.deleted_at')->whereNull('o.user_id')
            ->where('o.email', 'not like', '%@autovet.ai')
            ->pluck('p.id')->all();
        $petTemplates = $db->table('pets')->whereNull('deleted_at')->whereNull('synthetic_batch')
            ->get(['species_id', 'breed_id', 'date_of_birth', 'age_group', 'sex', 'weight', 'size_category_id', 'color', 'weight_unit', 'status']);

        // ------------------------------------------------------- gap weeks
        $realPerDay = $db->table('invoices')->whereNull('synthetic_batch')
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->endOfDay()->toDateTimeString()])
            ->selectRaw('DATE(created_at) AS d, COUNT(*) AS n')->groupBy('d')->pluck('n', 'd');
        $weeks = [];
        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            $key = $day->startOfWeek()->toDateString();
            $weeks[$key]['days'][] = $day;
            $weeks[$key]['real'] = ($weeks[$key]['real'] ?? 0) + (int) ($realPerDay[$day->toDateString()] ?? 0);
            $weeks[$key]['expected'] = ($weeks[$key]['expected'] ?? 0) + $lambda * $weights[$day->dayOfWeekIso % 7 + 1];
        }
        $threshold = (float) $this->option('gap-threshold');

        // ------------------------------------------------------- generate
        $owners = $pets = $appointments = $invoices = $items = [];
        $pool = $demoPets;
        $numbers = [];
        foreach ($weeks as $key => $week) {
            $weeks[$key]['filled'] = $week['real'] < $threshold * $week['expected'];
            foreach ($week['days'] as $day) {
                $nClients = ForecastMetrics::poisson($clientRate, fn () => $this->uniform());
                $nInvoices = ForecastMetrics::poisson($lambda * $weights[$day->dayOfWeekIso % 7 + 1], fn () => $this->uniform());
                if (!$weeks[$key]['filled']) {
                    continue;
                }

                for ($c = 0; $c < $nClients; $c++) {
                    $first = $this->pick(self::FIRST_NAMES);
                    $last = $this->pick(self::LAST_NAMES);
                    [$city, $province, $zip] = $this->pick(self::CITIES);
                    $stamp = $this->stamp($day, $tz);
                    $ownerUuid = (string) Str::uuid();
                    $owners[] = [
                        'clinic_id' => $clinicId, 'uuid' => $ownerUuid, 'name' => "{$first} {$last}",
                        'phone' => '09' . str_pad((string) $this->int(100000000, 999999999), 9, '0', STR_PAD_LEFT),
                        'email' => strtolower(str_replace(' ', '', $first) . '.' . str_replace(' ', '', $last)) . '.' . $this->int(10, 99) . '@example.com',
                        'address' => $this->int(1, 250) . ' ' . $this->pick(self::STREETS), 'city' => $city, 'province' => $province, 'zip' => $zip,
                        'is_seeded' => 1, 'synthetic_batch' => $batch, 'created_at' => $stamp, 'updated_at' => $stamp,
                    ];
                    $t = $petTemplates->isNotEmpty() ? $petTemplates[$this->int(0, $petTemplates->count() - 1)] : null;
                    $petUuid = (string) Str::uuid();
                    $pets[] = [
                        'clinic_id' => $clinicId, 'uuid' => $petUuid, 'owner_uuid' => $ownerUuid, 'name' => $this->pick(self::PET_NAMES),
                        'species_id' => $t->species_id ?? null, 'breed_id' => $t->breed_id ?? null, 'date_of_birth' => $t->date_of_birth ?? null,
                        'age_group' => $t->age_group ?? null, 'sex' => $t->sex ?? null, 'weight' => $t->weight ?? null,
                        'size_category_id' => $t->size_category_id ?? null, 'color' => $t->color ?? null,
                        'weight_unit' => $t->weight_unit ?? 'kg', 'status' => $t->status ?? 'Active',
                        'synthetic_batch' => $batch, 'created_at' => $stamp, 'updated_at' => $stamp,
                    ];
                    $pool[] = 'uuid:' . $petUuid;
                }

                if (!$pool) {
                    continue;
                }
                for ($n = 0; $n < $nInvoices; $n++) {
                    $src = $refInvoices[$this->int(0, $refInvoices->count() - 1)];
                    $pet = $pool[$this->int(0, count($pool) - 1)];
                    $stamp = $this->stamp($day, $tz);
                    $lines = $refItems[$src->id];
                    $service = $lines->firstWhere('item_type', 'service') ?? $lines->first();
                    $info = $serviceInfo[$service->service_id ?? 0] ?? null;
                    $apptUuid = (string) Str::uuid();
                    $invUuid = (string) Str::uuid();

                    $appointments[] = [
                        'clinic_id' => $clinicId, 'uuid' => $apptUuid, 'title' => $service->name,
                        'date' => $day->toDateString(),
                        'time' => CarbonImmutable::parse($stamp, $tz)->setTimezone(self::CLINIC_TZ)->format('H:00'),
                        'category' => $info->category ?? null, 'tone' => '', 'pet' => $pet, 'service_id' => $service->service_id,
                        'status' => 'completed', 'is_walk_in' => 0, 'synthetic_batch' => $batch,
                        'created_at' => $stamp, 'updated_at' => $stamp,
                    ];

                    $month = $day->format('Y-m');
                    $numbers[$month] ??= $this->lastNumber($db, $month);
                    $numbers[$month]++;
                    $invoices[] = [
                        'clinic_id' => $clinicId, 'uuid' => $invUuid,
                        'invoice_number' => sprintf('VB-%s-%04d', $month, $numbers[$month]),
                        'pet' => $pet, 'appointment_uuid' => $apptUuid, 'status' => 'Paid',
                        'report_type' => $src->report_type, 'subtotal' => $src->subtotal, 'discount_type' => $src->discount_type,
                        'discount_value' => $src->discount_value, 'tax_rate' => $src->tax_rate, 'total' => $src->total,
                        'amount_paid' => $src->total, 'payment_method' => $src->payment_method, 'stock_deducted' => 1,
                        'service_date' => $day->toDateString(), 'synthetic_batch' => $batch,
                        'created_at' => $stamp, 'updated_at' => $stamp,
                    ];
                    foreach ($lines as $line) {
                        $items[] = [
                            'clinic_id' => $clinicId, 'invoice_uuid' => $invUuid, 'item_type' => $line->item_type,
                            'service_id' => $line->service_id, 'inventory_id' => $line->inventory_id, 'name' => $line->name,
                            'notes' => $line->notes, 'qty' => $line->qty, 'unit_price' => $line->unit_price,
                            'amount' => $line->amount, 'is_hidden' => $line->is_hidden, 'created_at' => $stamp, 'updated_at' => $stamp,
                        ];
                    }
                }
            }
        }

        // ------------------------------------------------------- report
        $filled = array_filter($weeks, fn ($w) => $w['filled']);
        $revenue = array_sum(array_map(fn ($i) => (float) $i['total'], $invoices));
        $this->line("Database: [{$connection}]  Invoice reference: {$refFrom->toDateString()} to {$refTo->toDateString()} ({$refDays} days, {$refInvoices->count()} invoices)");
        $this->line(sprintf('Invoices per day λ = %.2f  |  new clients per day = %.3f  |  weekday weights (Sun..Sat): %s',
            $lambda, $clientRate, implode(' ', array_map(fn ($w) => number_format($w, 3), $weights))));
        $this->line(sprintf('Weeks filled: %d of %d  |  invoices %d (₱%s)  |  line items %d  |  appointments %d  |  clients %d  |  pets %d',
            count($filled), count($weeks), count($invoices), number_format($revenue, 2), count($items), count($appointments), count($owners), count($pets)));

        if ($path = $this->option('report')) {
            $byMonth = [];
            foreach ($invoices as $i) {
                $m = substr($i['service_date'], 0, 7);
                $byMonth[$m]['invoices'] = ($byMonth[$m]['invoices'] ?? 0) + 1;
                $byMonth[$m]['revenue'] = ($byMonth[$m]['revenue'] ?? 0) + (float) $i['total'];
            }
            foreach ($owners as $o) {
                $m = substr($o['created_at'], 0, 7);
                $byMonth[$m]['clients'] = ($byMonth[$m]['clients'] ?? 0) + 1;
            }
            ksort($byMonth);
            file_put_contents($path, json_encode([
                'database' => $connection, 'batch' => $batch, 'seed' => (int) $this->option('seed'),
                'window' => [$from->toDateString(), $to->toDateString()],
                'invoice_reference' => [$refFrom->toDateString(), $refTo->toDateString(), $refDays, $refInvoices->count()],
                'invoices_per_day' => $lambda, 'reference_average_ticket' => $refInvoices->avg('total'),
                'weekday_weights' => $weights, 'invoices_by_weekday' => $byWeekday->all(),
                'client_reference' => [$cFrom->toDateString(), $cTo->toDateString(), $cDays, $newClients], 'clients_per_day' => $clientRate,
                'eligible_existing_pets' => count($demoPets),
                'weeks' => array_map(fn ($k, $w) => ['week_of' => $k, 'real' => $w['real'], 'expected' => round($w['expected'], 1), 'filled' => $w['filled']], array_keys($weeks), $weeks),
                'by_month' => $byMonth,
                'totals' => ['invoices' => count($invoices), 'revenue' => $revenue, 'items' => count($items),
                    'appointments' => count($appointments), 'clients' => count($owners), 'pets' => count($pets)],
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->line("Report written to {$path}");
        }

        if ($this->option('dry-run')) {
            $this->warn('Dry run: nothing written.');
            return self::SUCCESS;
        }

        // ------------------------------------------------------- write
        $db->transaction(function () use ($db, $owners, $pets, $appointments, $invoices, $items) {
            foreach (array_chunk($owners, 500) as $chunk) {
                $db->table('owners')->insert($chunk);
            }
            $ownerIds = $db->table('owners')->whereIn('uuid', array_column($owners, 'uuid'))->pluck('id', 'uuid');
            foreach (array_chunk($pets, 500) as $chunk) {
                $db->table('pets')->insert(array_map(function ($p) use ($ownerIds) {
                    $p['owner_id'] = $ownerIds[$p['owner_uuid']];
                    unset($p['owner_uuid']);
                    return $p;
                }, $chunk));
            }
            $petIds = $db->table('pets')->whereIn('uuid', array_column($pets, 'uuid'))->pluck('id', 'uuid');
            $resolvePet = fn ($p) => is_string($p) && str_starts_with($p, 'uuid:') ? $petIds[substr($p, 5)] : $p;

            foreach (array_chunk($appointments, 500) as $chunk) {
                $db->table('appointments')->insert(array_map(function ($a) use ($resolvePet) {
                    $a['pet_id'] = $resolvePet($a['pet']);
                    unset($a['pet']);
                    return $a;
                }, $chunk));
            }
            $apptIds = collect(array_chunk(array_column($appointments, 'uuid'), 1000))
                ->flatMap(fn ($u) => $db->table('appointments')->whereIn('uuid', $u)->pluck('id', 'uuid'));

            foreach (array_chunk($invoices, 500) as $chunk) {
                $db->table('invoices')->insert(array_map(function ($i) use ($resolvePet, $apptIds) {
                    $i['pet_id'] = $resolvePet($i['pet']);
                    $i['appointment_id'] = $apptIds[$i['appointment_uuid']];
                    unset($i['pet'], $i['appointment_uuid']);
                    return $i;
                }, $chunk));
            }
            $invIds = collect(array_chunk(array_column($invoices, 'uuid'), 1000))
                ->flatMap(fn ($u) => $db->table('invoices')->whereIn('uuid', $u)->pluck('id', 'uuid'));

            foreach (array_chunk($items, 500) as $chunk) {
                $db->table('invoice_items')->insert(array_map(function ($it) use ($invIds) {
                    $it['invoice_id'] = $invIds[$it['invoice_uuid']];
                    unset($it['invoice_uuid']);
                    return $it;
                }, $chunk));
            }
        });

        $this->clearDashboardCache($db, $connection);
        $this->info('Written: ' . count($invoices) . ' invoices, ' . count($appointments) . ' appointments, '
            . count($owners) . ' clients, ' . count($pets) . " pets, labelled {$batch}.");

        return self::SUCCESS;
    }

    private function purge($db, string $connection, string $batch): int
    {
        $invoiceIds = $db->table('invoices')->where('synthetic_batch', $batch)->pluck('id');
        $counts = [
            'invoice items' => $db->table('invoice_items')->whereIn('invoice_id', $invoiceIds)->count(),
            'invoices' => $invoiceIds->count(),
            'appointments' => $db->table('appointments')->where('synthetic_batch', $batch)->count(),
            'pets' => $db->table('pets')->where('synthetic_batch', $batch)->count(),
            'clients' => $db->table('owners')->where('synthetic_batch', $batch)->count(),
        ];
        if (!$this->option('dry-run')) {
            $db->transaction(function () use ($db, $batch, $invoiceIds) {
                foreach ($invoiceIds->chunk(1000) as $ids) {
                    $db->table('invoice_items')->whereIn('invoice_id', $ids)->delete();
                }
                $db->table('invoices')->where('synthetic_batch', $batch)->delete();
                $db->table('appointments')->where('synthetic_batch', $batch)->delete();
                $db->table('pets')->where('synthetic_batch', $batch)->delete();
                $db->table('owners')->where('synthetic_batch', $batch)->delete();
            });
            $this->clearDashboardCache($db, $connection);
        }
        $this->info(($this->option('dry-run') ? 'Would delete: ' : 'Deleted: ')
            . collect($counts)->map(fn ($n, $k) => "{$n} {$k}")->implode(', ') . " of batch {$batch} on [{$connection}].");

        return self::SUCCESS;
    }

    /** Dashboard figures are cached for up to an hour; drop them so the new rows show at once. */
    private function clearDashboardCache($db, string $connection): void
    {
        if ($connection === 'mysql') {
            \App\Support\DashboardCache::forgetEverywhere();
        }
        if (Schema::connection($connection)->hasTable('cache')) {
            $db->table('cache')->where('key', 'like', '%dashboard%')->delete();
        }
    }

    private function lastNumber($db, string $month): int
    {
        $last = $db->table('invoices')->where('invoice_number', 'like', "VB-{$month}-%")
            ->orderByDesc('invoice_number')->value('invoice_number');
        return $last ? (int) substr($last, -4) : 0;
    }

    /** A moment during clinic hours (08:00–17:59 Manila) on the given day, in the app's timezone. */
    private function stamp(CarbonImmutable $day, string $tz): string
    {
        return CarbonImmutable::parse($day->toDateString() . ' 08:00:00', self::CLINIC_TZ)
            ->addMinutes($this->int(0, 599))->setTimezone($tz)->toDateTimeString();
    }

    private function pick(array $values)
    {
        return $values[$this->int(0, count($values) - 1)];
    }

    private function int(int $min, int $max): int
    {
        return $min + (int) floor($this->uniform() * ($max - $min + 1));
    }

    /** Deterministic uniform number in (0, 1) — a 32-bit LCG, so the same seed gives the same rows on any machine. */
    private function uniform(): float
    {
        $this->randState = (1664525 * $this->randState + 1013904223) % 4294967296;
        return ($this->randState + 1) / 4294967297;
    }
}

<?php

namespace Database\Seeders;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Appointment;
use App\Models\Breed;
use App\Models\Clinic;
use App\Models\CmsContent;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\MedicalRecord;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\PortalUser;
use App\Models\Review;
use App\Models\Service;
use App\Models\ServiceConsumable;
use App\Models\Species;
use App\Models\SystemAnnouncement;
use App\Models\VetSchedule;
use App\Models\WeightRange;
use App\Services\PricingService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Seeds the operational half of the clinic: the staff who do the work, the
 * visits they perform, and the records those visits produce.
 *
 * The other mock seeders only ever produced owners, pets and bare appointments,
 * and they did it under the `client.prod.%@autovet.ph` address that
 * Owner::scopeRealClients() filters out on purpose. Everything they wrote was
 * therefore invisible to the appointment list, the dashboard and the invoice
 * screen, while the clinical, billing, scheduling and stock-movement tables were
 * never written to at all. The clients below use ordinary addresses so they
 * survive that scope, and each of their visits carries the full paper trail.
 */
class ClinicOperationsSeeder extends Seeder
{
    /** Marks every row this seeder owns, so a re-run replaces its own data. */
    private const DEMO_EMAIL_DOMAIN = ClinicStaffSeeder::EMAIL_DOMAIN;

    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) {
            $this->command->warn('ClinicOperationsSeeder: no clinic, skipping.');
            return;
        }

        // Staff and their roster come from ClinicStaffSeeder, which runs early so
        // that every seeder booking a visit has a vet to assign it to.
        $vets = ClinicStaffSeeder::veterinarians($clinic);
        if ($vets->isEmpty()) {
            $this->command->warn('ClinicOperationsSeeder: no veterinarians, skipping.');
            return;
        }

        $this->seedServiceConsumables($clinic);

        $this->reset();

        $owners = $this->seedClients($clinic);
        $this->seedVisits($clinic, $owners, $vets);

        $this->seedStockMovements($clinic, $vets->first());
        $this->seedReviews($clinic);
        $this->seedAnnouncements();
        $this->seedCmsContent($clinic);

        $petIds = $this->demoPetIds();

        $this->command->info(sprintf(
            'ClinicOperationsSeeder: %d clients, %d pets, %d appointments, %d medical records, %d invoices.',
            count($this->demoOwnerIds()),
            count($petIds),
            Appointment::whereIn('pet_id', $petIds)->count(),
            MedicalRecord::whereIn('pet_id', $petIds)->count(),
            Invoice::whereIn('pet_id', $petIds)->count()
        ));
    }

    /**
     * Wipe only the rows this seeder created, so a re-run does not stack up
     * duplicate clients or double-count revenue.
     */
    private function reset(): void
    {
        $ownerIds = $this->demoOwnerIds();
        if (empty($ownerIds)) {
            return;
        }

        $petIds = Pet::withTrashed()->whereIn('owner_id', $ownerIds)->pluck('id')->all();

        if (!empty($petIds)) {
            $invoiceIds = Invoice::whereIn('pet_id', $petIds)->pluck('id')->all();
            Review::whereIn('invoice_id', $invoiceIds)->delete();
            InvoiceItem::whereIn('invoice_id', $invoiceIds)->delete();
            Invoice::whereIn('id', $invoiceIds)->delete();

            MedicalRecord::withTrashed()->whereIn('pet_id', $petIds)->forceDelete();

            $appointmentIds = Appointment::withTrashed()->whereIn('pet_id', $petIds)->pluck('id')->all();
            DB::table('appointment_services')->whereIn('appointment_id', $appointmentIds)->delete();
            Appointment::withTrashed()->whereIn('id', $appointmentIds)->forceDelete();

            Pet::withTrashed()->whereIn('id', $petIds)->forceDelete();
        }

        // Both models soft-delete, and the unique indexes on email do not
        // exclude trashed rows — so a plain delete() here would leave the old
        // addresses in place and the next run would collide on them. Owners go
        // first, because owners.user_id points at the portal account.
        Owner::withTrashed()->whereIn('id', $ownerIds)->forceDelete();

        PortalUser::withTrashed()
            ->where('email', 'like', '%' . self::DEMO_EMAIL_DOMAIN)
            ->forceDelete();
    }

    private function demoOwnerIds(): array
    {
        return Owner::withTrashed()
            ->where('email', 'like', '%' . self::DEMO_EMAIL_DOMAIN)
            ->pluck('id')
            ->all();
    }

    private function demoPetIds(): array
    {
        return Pet::whereIn('owner_id', $this->demoOwnerIds())->pluck('id')->all();
    }

    /**
     * Ties vaccination services to the stock they burn, which is what lets
     * finalising an invoice deduct from inventory.
     */
    private function seedServiceConsumables(Clinic $clinic): void
    {
        $map = [
            'Anti-Rabies Vaccine'   => 'Nobivac Rabies',
            '5 in 1 Vaccine (Dogs)' => 'Nobivac DHPPi',
            '6 in 1 Vaccine (Dogs)' => 'Nobivac L4',
            '4 in 1 Vaccine (Cats)' => 'Nobivac Tricat Trio',
        ];

        foreach ($map as $serviceName => $itemNeedle) {
            $service = Service::where('clinic_id', $clinic->id)->where('name', $serviceName)->first();
            if (!$service) {
                continue;
            }

            // The vaccine itself, plus the syringe and needle that go with any
            // injection.
            foreach ([$itemNeedle, 'Syringe 3 mL', 'Needle 23G'] as $needle) {
                $item = Inventory::where('clinic_id', $clinic->id)
                    ->where('item_name', 'like', $needle . '%')
                    ->first();

                if (!$item) {
                    continue;
                }

                ServiceConsumable::updateOrCreate(
                    ['service_id' => $service->id, 'inventory_id' => $item->id],
                    ['quantity' => 1]
                );
            }
        }
    }

    /** Named clients whose addresses survive Owner::scopeRealClients(). */
    private function seedClients(Clinic $clinic)
    {
        $clients = [
            ['Andrea Villanueva', 'Quezon City',  'Metro Manila'],
            ['Benjamin Ocampo',   'Makati',       'Metro Manila'],
            ['Carmela Lazaro',    'Pasig',        'Metro Manila'],
            ['Diego Fernandez',   'Mandaluyong',  'Metro Manila'],
            ['Elena Marquez',     'San Juan',     'Metro Manila'],
            ['Francis Tolentino', 'Taguig',       'Metro Manila'],
            ['Grace Alonzo',      'Marikina',     'Metro Manila'],
            ['Hector Salazar',    'Caloocan',     'Metro Manila'],
            ['Isabel Navarro',    'Paranaque',    'Metro Manila'],
            ['Joaquin Ramos',     'Las Pinas',    'Metro Manila'],
            ['Katrina Bernardo',  'Muntinlupa',   'Metro Manila'],
            ['Lorenzo Aquino',    'Valenzuela',   'Metro Manila'],
            ['Monica Castillo',   'Antipolo',     'Rizal'],
            ['Nestor Pangilinan', 'Cainta',       'Rizal'],
            ['Olivia Domingo',    'Bacoor',       'Cavite'],
            ['Paolo Gutierrez',   'Imus',         'Cavite'],
            ['Regina Soriano',    'Santa Rosa',   'Laguna'],
            ['Samuel Herrera',    'Binan',        'Laguna'],
            ['Teresa Mercado',    'Quezon City',  'Metro Manila'],
            ['Ulysses Cabrera',   'Pasay',        'Metro Manila'],
            ['Veronica Padilla',  'Malabon',      'Metro Manila'],
            ['Wilfredo Estrada',  'Navotas',      'Metro Manila'],
            ['Ximena Roxas',      'Pateros',      'Metro Manila'],
            ['Yolanda Cruz',      'Taytay',       'Rizal'],
        ];

        $owners = collect();

        foreach ($clients as $index => [$name, $city, $province]) {
            // Registrations spread over the past year so the growth chart curves.
            $registered = Carbon::now()->subDays(rand(10, 360))->setHour(rand(8, 17));

            $owner = Owner::create([
                'clinic_id' => $clinic->id,
                'name' => $name,
                'email' => Str::slug($name, '.') . self::DEMO_EMAIL_DOMAIN,
                'phone' => '09' . rand(100000000, 999999999),
                'address' => (100 + $index) . ' Mabini Street',
                'city' => $city,
                'province' => $province,
                'zip' => (string) rand(1000, 4999),
                'created_at' => $registered,
                'updated_at' => $registered,
            ]);

            $this->seedPetsFor($clinic, $owner, $registered);
            $owners->push($owner);
        }

        // Give the first few clients portal logins, so the client-facing app has
        // accounts that resolve to a real owner record.
        foreach ($owners->take(5) as $owner) {
            $portalUser = PortalUser::create([
                'clinic_id' => $clinic->id,
                'name' => $owner->name,
                'email' => $owner->email,
                'phone' => $owner->phone,
                'address' => $owner->address,
                'city' => $owner->city,
                'province' => $owner->province,
                'zip' => $owner->zip,
                'password' => Hash::make('password123'),
                'status' => 'active',
                'email_verified_at' => now(),
            ]);

            $owner->update(['user_id' => $portalUser->id]);
        }

        return $owners;
    }

    private function seedPetsFor(Clinic $clinic, Owner $owner, Carbon $registered): void
    {
        $dogNames = ['Bantay', 'Coco', 'Max', 'Buboy', 'Luna', 'Chichi', 'Rocky', 'Bella', 'Tiny', 'Mochi'];
        $catNames = ['Muning', 'Simba', 'Kitty', 'Shadow', 'Ashy', 'Puti', 'Tiger', 'Nala'];
        $colors = ['Black', 'White', 'Brown', 'Golden', 'Grey', 'Tricolor', 'Tan'];

        $canine = Species::where('name', 'Canine')->first();
        $feline = Species::where('name', 'Feline')->first();

        foreach (range(1, rand(1, 3)) as $ignored) {
            $species = rand(0, 100) < 65 ? $canine : $feline;
            if (!$species) {
                continue;
            }

            $isDog = $canine && $species->id === $canine->id;
            // Weights sit inside a configured range, so weight-based pricing resolves.
            $weight = $isDog ? rand(30, 350) / 10 : rand(25, 95) / 10;
            $breed = Breed::where('species_id', $species->id)->inRandomOrder()->first();

            Pet::create([
                'clinic_id' => $clinic->id,
                'owner_id' => $owner->id,
                'name' => $isDog ? $dogNames[array_rand($dogNames)] : $catNames[array_rand($catNames)],
                'species_id' => $species->id,
                'breed_id' => $breed?->id,
                'date_of_birth' => Carbon::now()->subMonths(rand(6, 144))->toDateString(),
                'sex' => rand(0, 1) ? 'Male' : 'Female',
                'color' => $colors[array_rand($colors)],
                'weight' => $weight,
                'weight_unit' => 'kg',
                'size_category_id' => $this->sizeCategoryFor($species->id, $weight),
                'status' => 'Active',
                'created_at' => $registered,
                'updated_at' => $registered,
            ]);
        }
    }

    private function sizeCategoryFor(int $speciesId, float $weight): ?int
    {
        return WeightRange::where('status', 'Active')
            ->where('species_id', $speciesId)
            ->where('min_weight', '<=', $weight)
            ->where(fn($q) => $q->where('max_weight', '>=', $weight)->orWhereNull('max_weight'))
            ->value('size_category_id');
    }

    /**
     * The heart of it: every pet gets a visit history, and each visit that
     * actually happened leaves behind the appointment, the services rendered,
     * the medical record and the invoice, the way a real one would.
     */
    private function seedVisits(Clinic $clinic, $owners, $vets): void
    {
        $services = Service::where('clinic_id', $clinic->id)->where('status', 'Active')->get();
        if ($services->isEmpty() || $vets->isEmpty()) {
            return;
        }

        $pricing = new PricingService();
        $pets = Pet::whereIn('owner_id', $owners->pluck('id'))->get();

        $complaints = [
            'Routine wellness check' => ['Alert and responsive, no abnormalities noted.', 'Healthy, no active disease.', 'Continue current diet; return in six months.'],
            'Scheduled immunisation' => ['Temperature and mucous membranes normal.', 'Fit for vaccination.', 'Vaccine given subcutaneously; monitor for 30 minutes.'],
            'Itching and hair loss' => ['Erythema along the flank, mild alopecia.', 'Flea allergy dermatitis.', 'Topical treatment for 14 days; ectoparasite control.'],
            'Loss of appetite' => ['Mild dehydration, abdomen soft on palpation.', 'Suspected dietary indiscretion.', 'Bland diet for 3 days; recheck if signs persist.'],
            'Limping on hind leg' => ['Pain on extension of the right stifle.', 'Soft tissue strain.', 'Rest and anti-inflammatories for 7 days.'],
            'Vomiting since yesterday' => ['Slightly tacky mucous membranes, no fever.', 'Acute gastritis.', 'Anti-emetic given; small frequent meals.'],
            'Coat and nail care' => ['Coat matted along the hindquarters.', 'No dermatological disease.', 'Full groom performed; nails trimmed.'],
        ];
        $complaintKeys = array_keys($complaints);

        $paymentMethods = ['Cash', 'GCash', 'Credit Card', 'Bank Transfer'];
        $invoiceSequence = [];

        foreach ($pets as $pet) {
            for ($v = 0, $visits = rand(2, 5); $v < $visits; $v++) {
                // Most visits are in the past; a few sit in the coming weeks, so
                // the upcoming-appointments panel is not empty either.
                $isFuture = $v === 0 && rand(0, 100) < 35;
                $date = $isFuture
                    ? Carbon::now()->addDays(rand(1, 21))
                    : Carbon::now()->subDays(rand(5, 330));

                $service = $services->random();
                $vet = $vets->random();
                $complaint = $complaintKeys[array_rand($complaintKeys)];
                $status = $this->statusFor($isFuture);
                $hour = rand(8, 16);

                $appointment = Appointment::create([
                    'clinic_id' => $clinic->id,
                    'uuid' => (string) Str::uuid(),
                    'title' => $service->name . ' for ' . $pet->name,
                    'date' => $date->toDateString(),
                    'time' => sprintf(
                        '%02d:%02d %s',
                        $hour > 12 ? $hour - 12 : $hour,
                        rand(0, 1) ? 0 : 30,
                        $hour >= 12 ? 'PM' : 'AM'
                    ),
                    'category' => $service->category,
                    'pet_id' => $pet->id,
                    'service_id' => $service->id,
                    'vet_id' => $service->requires_doctor ? $vet->id : null,
                    'status' => $status,
                    'is_walk_in' => !$isFuture && rand(0, 100) < 18,
                    'notes' => $complaint,
                    'decline_reason' => $status === 'declined' ? 'Requested slot no longer available.' : null,
                    'created_at' => $date->copy()->subDays(rand(1, 10)),
                    'updated_at' => $date,
                ]);

                DB::table('appointment_services')->insert([
                    'appointment_id' => $appointment->id,
                    'service_id' => $service->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if ($status !== 'completed') {
                    continue;
                }

                [$findings, $diagnosis, $plan] = $complaints[$complaint];

                MedicalRecord::create([
                    'clinic_id' => $clinic->id,
                    'uuid' => (string) Str::uuid(),
                    'pet_id' => $pet->id,
                    'vet_id' => $vet->id,
                    'appointment_id' => $appointment->id,
                    'chief_complaint' => $complaint,
                    'findings' => $findings,
                    'diagnosis' => $diagnosis,
                    'treatment_plan' => $plan,
                    'notes' => 'Owner advised on home care and warning signs.',
                    'follow_up_date' => rand(0, 100) < 40 ? $date->copy()->addWeeks(rand(2, 12))->toDateString() : null,
                    'follow_up_time' => '10:00:00',
                    'created_at' => $date,
                    'updated_at' => $date,
                ]);

                $this->createInvoice($clinic, $pet, $appointment, $service, $date, $pricing, $paymentMethods, $invoiceSequence);
            }
        }
    }

    /** Past visits are mostly done; future ones are still awaiting the clinic. */
    private function statusFor(bool $isFuture): string
    {
        if ($isFuture) {
            return rand(0, 100) < 65 ? 'approved' : 'pending';
        }

        $roll = rand(0, 100);

        if ($roll < 82) {
            return 'completed';
        }

        return $roll < 91 ? 'cancelled' : 'declined';
    }

    private function createInvoice(
        Clinic $clinic,
        Pet $pet,
        Appointment $appointment,
        Service $service,
        Carbon $date,
        PricingService $pricing,
        array $paymentMethods,
        array &$sequence
    ): void {
        try {
            $unitPrice = $pricing->calculatePrice($service, $pet);
        } catch (\Throwable $e) {
            // A service with no rule for this pet cannot be billed. The visit
            // still stands, it just carries no invoice.
            return;
        }

        if ($unitPrice <= 0) {
            return;
        }

        $monthKey = $date->format('Y-m');
        $sequence[$monthKey] = ($sequence[$monthKey] ?? 0) + 1;
        $invoiceNumber = "VB-{$monthKey}-" . str_pad((string) $sequence[$monthKey], 4, '0', STR_PAD_LEFT);

        $items = [[
            'item_type' => 'service',
            'service_id' => $service->id,
            'inventory_id' => null,
            'name' => $service->name,
            'qty' => 1,
            'unit_price' => $unitPrice,
        ]];

        // Roughly half of visits also dispense something off the shelf.
        if (rand(0, 100) < 50) {
            $item = Inventory::where('clinic_id', $clinic->id)
                ->where('is_billable', true)
                ->where('selling_price', '>', 0)
                ->inRandomOrder()
                ->first();

            if ($item) {
                $items[] = [
                    'item_type' => 'product',
                    'service_id' => null,
                    'inventory_id' => $item->id,
                    'name' => $item->item_name,
                    'qty' => rand(1, 3),
                    'unit_price' => (float) $item->selling_price,
                ];
            }
        }

        $subtotal = 0.0;
        foreach ($items as $item) {
            $subtotal += $item['unit_price'] * $item['qty'];
        }

        $discountValue = rand(0, 100) < 20 ? 5 : 0;
        $total = round($subtotal - ($subtotal * $discountValue / 100), 2);

        // Older invoices have settled; the most recent few may still be open.
        $isPaid = $date->lt(Carbon::now()->subDays(14)) || rand(0, 100) < 70;

        $invoice = Invoice::create([
            'clinic_id' => $clinic->id,
            'invoice_number' => $invoiceNumber,
            'pet_id' => $pet->id,
            'appointment_id' => $appointment->id,
            'service_date' => $date->toDateString(),
            'report_type' => 'transaction',
            'status' => $isPaid ? 'Paid' : 'Finalized',
            'subtotal' => $subtotal,
            'discount_type' => 'percentage',
            'discount_value' => $discountValue,
            'tax_rate' => 0,
            'total' => $total,
            'amount_paid' => $isPaid ? $total : 0,
            'payment_method' => $isPaid ? $paymentMethods[array_rand($paymentMethods)] : null,
            'notes_to_client' => 'Thank you for choosing Pet Wellness Animal Clinic.',
            'created_at' => $date,
            'updated_at' => $date,
        ]);

        // stock_deducted is a column on the table, not a fillable field.
        $invoice->forceFill(['stock_deducted' => true])->save();

        foreach ($items as $item) {
            InvoiceItem::create([
                'clinic_id' => $clinic->id,
                'uuid' => (string) Str::uuid(),
                'invoice_id' => $invoice->id,
                'item_type' => $item['item_type'],
                'service_id' => $item['service_id'],
                'inventory_id' => $item['inventory_id'],
                'name' => $item['name'],
                'qty' => $item['qty'],
                'unit_price' => $item['unit_price'],
                'amount' => $item['unit_price'] * $item['qty'],
                'created_at' => $date,
                'updated_at' => $date,
            ]);
        }
    }

    /**
     * Deliveries in and dispensing out, so the stock card behind each item is
     * not a blank page and the current stock level has an explanation.
     */
    private function seedStockMovements(Clinic $clinic, ?Admin $vet): void
    {
        InventoryTransaction::where('clinic_id', $clinic->id)->delete();

        $rows = [];

        foreach (Inventory::where('clinic_id', $clinic->id)->get() as $item) {
            $onHand = (int) $item->stock_level;
            $running = max(0, $onHand - rand(20, 60));

            // Opening balance, then alternating deliveries and dispensing, with a
            // closing count that lands the ledger on the item's present stock.
            $rows[] = $this->movement($clinic, $item, 'stock_in', $running, 0, $running, 'Opening balance', $vet, Carbon::now()->subMonths(8));

            foreach (range(1, rand(3, 6)) as $step) {
                $isIn = rand(0, 100) < 55;
                $qty = $isIn ? rand(10, 50) : rand(1, max(1, min(15, $running)));
                $previous = $running;
                $running = $isIn ? $running + $qty : max(0, $running - $qty);

                $rows[] = $this->movement(
                    $clinic,
                    $item,
                    $isIn ? 'stock_in' : 'stock_out',
                    $qty,
                    $previous,
                    $running,
                    $isIn ? 'Supplier delivery' : 'Dispensed for patient treatment',
                    $vet,
                    Carbon::now()->subMonths(8)->addDays($step * rand(10, 30))
                );
            }

            if ($running !== $onHand) {
                $delta = $onHand - $running;

                $rows[] = $this->movement(
                    $clinic,
                    $item,
                    $delta > 0 ? 'stock_in' : 'stock_out',
                    abs($delta),
                    $running,
                    $onHand,
                    'Physical count adjustment',
                    $vet,
                    Carbon::now()->subDays(rand(1, 20))
                );
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            InventoryTransaction::insert($chunk);
        }
    }

    private function movement(Clinic $clinic, Inventory $item, string $type, int $qty, int $previous, int $new, string $remarks, ?Admin $vet, Carbon $at): array
    {
        return [
            'clinic_id' => $clinic->id,
            'uuid' => (string) Str::uuid(),
            'inventory_id' => $item->id,
            'transaction_type' => $type,
            'quantity' => $qty,
            'previous_stock' => $previous,
            'new_stock' => $new,
            'remarks' => $remarks,
            'created_by' => $vet?->id,
            'created_at' => $at,
            'updated_at' => $at,
        ];
    }

    /** Client feedback attached to invoices that were actually paid. */
    private function seedReviews(Clinic $clinic): void
    {
        $written = [
            [5, 'Very thorough vets', 'The vet explained every step of the check-up and did not rush us. Our dog was calm the whole time.'],
            [5, 'Quick and caring', 'We walked in without an appointment and were seen within twenty minutes. Staff were gentle with our cat.'],
            [4, 'Good service, small wait', 'Treatment was excellent. The wait on a Saturday morning was a bit long, but worth it.'],
            [5, 'Clear billing', 'I appreciated getting an itemised invoice before paying. No surprise charges at all.'],
            [4, 'Helpful follow-up', 'They messaged to remind us about the follow-up shot, which we would have forgotten.'],
            [5, 'Grooming was excellent', 'Our retriever came back looking wonderful and smelled great for days afterwards.'],
            [3, 'Fine, but busy', 'The care was good, but the clinic was crowded on a weekday afternoon.'],
            [5, 'Saved our kitten', 'Brought our kitten in vomiting and she was back to normal in two days. Very grateful.'],
        ];

        $invoices = Invoice::where('clinic_id', $clinic->id)
            ->where('status', 'Paid')
            ->with(['pet.owner', 'pet.species'])
            ->inRandomOrder()
            ->take(count($written))
            ->get();

        foreach ($invoices as $index => $invoice) {
            [$rating, $title, $body] = $written[$index];
            $owner = $invoice->pet?->owner;

            if (!$owner) {
                continue;
            }

            Review::create([
                'clinic_id' => $clinic->id,
                'portal_user_id' => $owner->user_id,
                'invoice_id' => $invoice->id,
                'rating' => $rating,
                'title' => $title,
                'body' => $body,
                'reviewer_name' => $owner->name,
                'pet_name' => $invoice->pet?->name,
                'pet_species' => $invoice->pet?->species?->name,
                'is_approved' => true,
                'is_featured' => $index < 3,
                'created_at' => $invoice->created_at,
                'updated_at' => $invoice->created_at,
            ]);
        }
    }

    private function seedAnnouncements(): void
    {
        $admin = Admin::where('role', Roles::SUPER_ADMIN->value)->first();

        $announcements = [
            ['Holiday clinic hours', 'The clinic operates from 9:00 AM to 1:00 PM on public holidays. Emergency cases are still accepted.', 'info', 'all'],
            ['Anti-rabies drive this month', 'Discounted anti-rabies vaccination for all registered pets until the end of the month.', 'success', 'portal'],
            ['Scheduled maintenance', 'The system will be briefly unavailable on Sunday, 2:00 AM to 4:00 AM, for scheduled maintenance.', 'warning', 'admin'],
            ['Now accepting online bookings', 'Book your pet\'s next visit from the client portal and pick the slot that suits you.', 'info', 'landing'],
        ];

        foreach ($announcements as [$title, $message, $type, $target]) {
            SystemAnnouncement::updateOrCreate(
                ['title' => $title],
                [
                    'message' => $message,
                    'type' => $type,
                    'target' => $target,
                    'is_active' => true,
                    'active_until' => Carbon::now()->addMonths(3),
                    'created_by' => $admin?->id,
                ]
            );
        }
    }

    private function seedCmsContent(Clinic $clinic): void
    {
        $entries = [
            ['hero', 'Compassionate care for every pet', 'Pet Wellness Animal Clinic has looked after companion animals in Metro Manila for over a decade, with a team of licensed veterinarians and a fully equipped treatment room.', 1],
            ['about', 'About the clinic', 'We provide preventive care, diagnostics, minor surgery and grooming under one roof. Our goal is simple: fewer emergencies, through consistent routine care.', 2],
            ['service', 'Wellness and vaccination', 'Annual check-ups, core vaccines and parasite control, scheduled around your pet\'s age and lifestyle.', 3],
            ['service', 'Diagnostics and laboratory', 'In-house blood work and rapid testing, so treatment can begin on the same visit.', 4],
            ['service', 'Grooming', 'Bathing, coat care and nail trimming, priced by your pet\'s weight.', 5],
            ['faq', 'Do I need an appointment?', 'Walk-ins are welcome, but booking ahead through the client portal means a shorter wait.', 6],
            ['faq', 'How often should my pet be vaccinated?', 'Puppies and kittens follow a starter series; adults are usually boosted once a year. Your vet will set the schedule.', 7],
        ];

        foreach ($entries as [$type, $title, $body, $order]) {
            CmsContent::updateOrCreate(
                ['clinic_id' => $clinic->id, 'type' => $type, 'title' => $title],
                [
                    'uuid' => (string) Str::uuid(),
                    'body' => $body,
                    'is_published' => true,
                    'display_order' => $order,
                ]
            );
        }
    }
}

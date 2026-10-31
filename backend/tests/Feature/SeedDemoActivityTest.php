<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SeedDemoActivityTest extends TestCase
{
    use RefreshDatabase;

    private int $portalPet;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore(['id' => 1, 'clinic_name' => 'Clinic', 'email' => 'c@example.com', 'status' => 'active']);

        $demoOwner = DB::table('owners')->insertGetId(['clinic_id' => 1, 'name' => 'Demo Client', 'email' => 'demo@example.com', 'created_at' => '2026-01-10']);
        $portalUser = DB::table('portal_users')->insertGetId(['name' => 'Portal Client', 'email' => 'p@example.com', 'password' => 'x']);
        $portalOwner = DB::table('owners')->insertGetId(['clinic_id' => 1, 'name' => 'Portal Client', 'email' => 'p@example.com', 'user_id' => $portalUser, 'created_at' => '2026-01-10']);
        $demoPet = DB::table('pets')->insertGetId(['clinic_id' => 1, 'owner_id' => $demoOwner, 'name' => 'Rex', 'weight_unit' => 'kg', 'status' => 'Active']);
        $this->portalPet = DB::table('pets')->insertGetId(['clinic_id' => 1, 'owner_id' => $portalOwner, 'name' => 'Real', 'weight_unit' => 'kg', 'status' => 'Active']);

        // Reference: two invoices a day in February.
        for ($d = CarbonImmutable::parse('2026-02-01'); $d->lte(CarbonImmutable::parse('2026-02-28')); $d = $d->addDay()) {
            foreach ([400, 650] as $total) {
                $id = DB::table('invoices')->insertGetId([
                    'clinic_id' => 1, 'invoice_number' => 'SEED-'.$d->format('md').$total, 'pet_id' => $demoPet,
                    'status' => 'Paid', 'subtotal' => $total, 'total' => $total, 'amount_paid' => $total,
                    'created_at' => $d->setTime(10, 0), 'updated_at' => $d->setTime(10, 0),
                ]);
                DB::table('invoice_items')->insert([
                    'clinic_id' => 1, 'invoice_id' => $id, 'item_type' => 'service', 'name' => 'Consultation',
                    'qty' => 1, 'unit_price' => $total, 'amount' => $total,
                ]);
            }
        }
    }

    private function runSeeder(array $extra = []): void
    {
        $this->artisan('demo:seed-activity', array_merge([
            '--from' => '2026-03-02', '--to' => '2026-03-15',
            '--ref-from' => '2026-02-01', '--ref-to' => '2026-02-28',
            '--client-ref-from' => '2026-01-01', '--client-ref-to' => '2026-01-31',
            '--seed' => 7, '--batch' => 'test-batch',
        ], $extra))->assertSuccessful();
    }

    public function test_generates_linked_labelled_activity_and_purges_it(): void
    {
        $this->runSeeder();

        $invoices = DB::table('invoices')->where('synthetic_batch', 'test-batch')->get();
        // About 2 a day for 14 days.
        $this->assertEqualsWithDelta(28, $invoices->count(), 14);

        foreach ($invoices as $invoice) {
            $this->assertSame('Paid', $invoice->status);
            $this->assertContains((float) $invoice->total, [400.0, 650.0]);
            $this->assertNotSame($this->portalPet, (int) $invoice->pet_id, 'portal clients never get generated invoices');
            $this->assertSame(1, DB::table('invoice_items')->where('invoice_id', $invoice->id)->count());
            $appt = DB::table('appointments')->find($invoice->appointment_id);
            $this->assertSame('completed', $appt->status);
            $this->assertSame('test-batch', $appt->synthetic_batch);
            $this->assertSame((int) $invoice->pet_id, (int) $appt->pet_id);
        }
        $this->assertSame($invoices->count(), $invoices->pluck('invoice_number')->unique()->count());

        $this->runSeeder(['--purge' => true]);
        foreach (['invoices', 'appointments', 'owners', 'pets'] as $table) {
            $this->assertSame(0, DB::table($table)->where('synthetic_batch', 'test-batch')->count(), $table);
        }
        $this->assertSame(56, DB::table('invoices')->count());
    }
}

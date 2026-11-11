<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Events\LowStockDetected;
use App\Models\Admin;
use App\Models\Appointment;
use App\Models\Inventory;
use App\Models\Invoice;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Unit tests for the clinic's core business rules, each checked in isolation:
 * pet age-group calculation, the low-stock trigger, and VAT on invoices.
 */
class BusinessRulesUnitTest extends TestCase
{
    use RefreshDatabase;

    private Owner $owner;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active'],
        ]);
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);
        $this->owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
    }

    private function petAged(string $species, int $months): Pet
    {
        $speciesId = Species::firstOrCreate(['name' => $species])->id;

        return Pet::create([
            'owner_id' => $this->owner->id, 'name' => 'Pet', 'species_id' => $speciesId,
            'date_of_birth' => now()->subMonths($months)->toDateString(),
        ]);
    }

    // --- Pet age calculation -------------------------------------------------

    public function test_pet_age_group_is_calculated_from_date_of_birth(): void
    {
        $this->assertSame('Baby', $this->petAged('Canine', 3)->age_group);
        $this->assertSame('Young', $this->petAged('Canine', 8)->age_group);
        $this->assertSame('Adult', $this->petAged('Canine', 36)->age_group);
        $this->assertSame('Senior', $this->petAged('Canine', 96)->age_group);
    }

    public function test_pet_age_group_uses_species_specific_thresholds(): void
    {
        // 8 years: a senior dog (adult up to 72 months) but still an adult cat (up to 108).
        $this->assertSame('Senior', $this->petAged('Canine', 96)->age_group);
        $this->assertSame('Adult', $this->petAged('Feline', 96)->age_group);
    }

    public function test_pet_without_date_of_birth_has_no_age_group(): void
    {
        $pet = Pet::create([
            'owner_id' => $this->owner->id, 'name' => 'Unknown', 'species_id' => Species::firstOrCreate(['name' => 'Canine'])->id,
        ]);

        $this->assertNull($pet->age_group);
    }

    // --- Stock level trigger -------------------------------------------------

    private function finalizeSaleOf(Inventory $item, int $qty): void
    {
        $pet = $this->petAged('Canine', 24);
        $service = Service::create(['name' => 'Consultation', 'base_price' => 500, 'price' => 500, 'pricing_mode' => 'manual']);
        $appointment = Appointment::create([
            'pet_id' => $pet->id, 'service_id' => $service->id,
            'date' => now()->toDateString(), 'time' => '10:00', 'status' => 'approved',
        ]);
        $amount = 100 * $qty;

        $this->postJson('/api/invoices', [
            'pet_id' => $pet->id, 'appointment_id' => $appointment->id, 'status' => 'Finalized',
            'subtotal' => $amount, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12,
            'total' => $amount, 'amount_paid' => 0,
            'items' => [[
                'item_type' => 'inventory', 'inventory_id' => $item->id, 'name' => $item->item_name,
                'qty' => $qty, 'unit_price' => 100, 'amount' => $amount,
            ]],
        ])->assertCreated();
    }

    private function stockItem(int $stock, int $min): Inventory
    {
        $item = Inventory::create([
            'clinic_id' => 1, 'item_name' => 'Rabies Vaccine', 'code' => 'TEST-'.uniqid(),
            'stock_level' => $stock, 'price' => 100, 'selling_price' => 100,
        ]);
        $item->forceFill(['min_stock_level' => $min, 'deduct_on_finalize' => true])->save();

        return $item;
    }

    public function test_sale_that_drops_stock_to_reorder_level_triggers_low_stock_alert(): void
    {
        Event::fake([LowStockDetected::class]);
        $item = $this->stockItem(22, 20);

        $this->finalizeSaleOf($item, 3);

        $this->assertSame(19, (int) $item->fresh()->stock_level);
        Event::assertDispatched(LowStockDetected::class, fn ($e) => $e->inventoryItem->id === $item->id);
    }

    public function test_sale_that_keeps_stock_above_reorder_level_does_not_trigger_alert(): void
    {
        Event::fake([LowStockDetected::class]);
        $item = $this->stockItem(100, 20);

        $this->finalizeSaleOf($item, 3);

        $this->assertSame(97, (int) $item->fresh()->stock_level);
        Event::assertNotDispatched(LowStockDetected::class);
    }

    // --- Tax (VAT) calculation -----------------------------------------------

    public function test_vat_is_extracted_from_vat_inclusive_amounts(): void
    {
        // Prices include 12% VAT: the VAT inside ₱1,120 is ₱120.
        $this->assertSame(120.0, Invoice::vatPortionOf(1120));
        $this->assertSame(53.57, Invoice::vatPortionOf(500));
        $this->assertSame(0.0, Invoice::vatPortionOf(0));
    }

    public function test_invoice_vat_follows_the_discounted_total(): void
    {
        $invoice = new Invoice(['total' => 1008]); // ₱1,120 less a 10% discount

        $this->assertSame(108.0, $invoice->vat_amount);
    }
}

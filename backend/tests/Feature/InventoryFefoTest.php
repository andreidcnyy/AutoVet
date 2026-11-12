<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Appointment;
use App\Models\Inventory;
use App\Models\InventoryCategory;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Models\Species;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Stock is used FEFO (first expired, first out), expired stock is never used,
 * and products that track expiry always carry an expiry date and a lot number.
 */
class InventoryFefoTest extends TestCase
{
    use RefreshDatabase;

    private Pet $pet;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active'],
        ]);
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(), ['*']);
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
        $this->pet = Pet::create(['owner_id' => $owner->id, 'name' => 'Rex', 'species_id' => Species::firstOrCreate(['name' => 'Canine'])->id]);
        $this->service = Service::create(['name' => 'Consultation', 'base_price' => 500, 'price' => 500, 'pricing_mode' => 'manual']);
    }

    private function batch(string $code, int $stock, ?string $expires, string $lot = 'LOT-1'): Inventory
    {
        $item = Inventory::create([
            'clinic_id' => 1, 'item_name' => 'Rabies Vaccine', 'code' => $code, 'sku' => $code.'-'.uniqid(), 'stock_level' => $stock,
            'price' => 100, 'selling_price' => 100, 'expiration_date' => $expires, 'lot_number' => $expires ? $lot : null,
        ]);
        $item->forceFill(['min_stock_level' => 0, 'deduct_on_finalize' => true])->save();

        return $item;
    }

    private function sell(Inventory $item, int $qty)
    {
        $appointment = Appointment::create([
            'pet_id' => $this->pet->id, 'service_id' => $this->service->id,
            'date' => now()->toDateString(), 'time' => '10:00', 'status' => 'approved',
        ]);
        $amount = 100 * $qty;

        return $this->postJson('/api/invoices', [
            'pet_id' => $this->pet->id, 'appointment_id' => $appointment->id, 'status' => 'Finalized',
            'subtotal' => $amount, 'discount_type' => 'fixed', 'discount_value' => 0, 'tax_rate' => 12,
            'total' => $amount, 'amount_paid' => 0,
            'items' => [[
                'item_type' => 'inventory', 'inventory_id' => $item->id, 'name' => $item->item_name,
                'qty' => $qty, 'unit_price' => 100, 'amount' => $amount,
            ]],
        ]);
    }

    // --- FEFO deduction --------------------------------------------------------

    public function test_the_batch_expiring_soonest_is_used_first_even_if_received_later(): void
    {
        $older = $this->batch('VAX', 10, now()->addMonths(8)->toDateString());   // received first
        $sooner = $this->batch('VAX', 10, now()->addMonths(2)->toDateString());  // received later, expires first

        $this->sell($older, 3)->assertCreated();

        $this->assertSame(10, (int) $older->fresh()->stock_level);
        $this->assertSame(7, (int) $sooner->fresh()->stock_level);
    }

    public function test_expired_stock_is_never_used(): void
    {
        $expired = $this->batch('VAX', 5, now()->subDay()->toDateString());
        $good = $this->batch('VAX', 5, now()->addMonths(3)->toDateString());

        $this->sell($expired, 3)->assertCreated();

        $this->assertSame(5, (int) $expired->fresh()->stock_level);
        $this->assertSame(2, (int) $good->fresh()->stock_level);
    }

    public function test_stock_expiring_today_can_still_be_used_today(): void
    {
        $today = $this->batch('VAX', 5, now()->toDateString());

        $this->sell($today, 2)->assertCreated();

        $this->assertSame(3, (int) $today->fresh()->stock_level);
    }

    public function test_billing_is_refused_when_the_only_stock_left_has_expired(): void
    {
        $expired = $this->batch('VAX', 5, now()->subDay()->toDateString());

        $this->sell($expired, 1)
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'EXPIRED'));

        $this->assertSame(5, (int) $expired->fresh()->stock_level);
    }

    public function test_batches_without_an_expiry_date_are_used_after_dated_ones(): void
    {
        $undated = $this->batch('GAUZE', 10, null);
        $dated = $this->batch('GAUZE', 10, now()->addYear()->toDateString());

        $this->sell($undated, 4)->assertCreated();

        $this->assertSame(10, (int) $undated->fresh()->stock_level);
        $this->assertSame(6, (int) $dated->fresh()->stock_level);
    }

    public function test_the_batch_list_shows_the_same_order_stock_is_used_in(): void
    {
        $expired = $this->batch('VAX', 5, now()->subDay()->toDateString());
        $undated = $this->batch('VAX', 5, null);
        $late = $this->batch('VAX', 5, now()->addMonths(9)->toDateString());
        $soon = $this->batch('VAX', 5, now()->addMonth()->toDateString());

        $ids = collect($this->getJson("/api/inventory/{$expired->id}/batches")->assertOk()->json('batches'))->pluck('id')->all();

        $this->assertSame([$soon->id, $late->id, $undated->id, $expired->id], $ids);
    }

    // --- Expiry date and lot number are required when tracking expiry ---------

    private function newProduct(array $overrides = []): array
    {
        $category = InventoryCategory::firstOrCreate(['name' => 'Vaccines'], ['clinic_id' => 1, 'status' => 'active']);

        return array_merge([
            'item_name' => 'Nobivac Rabies', 'code' => 'VAX-NEW', 'inventory_category_id' => $category->id,
            'stock_level' => 10, 'min_stock_level' => 2, 'status' => 'In Stock', 'price' => 400, 'selling_price' => 600,
        ], $overrides);
    }

    public function test_a_product_that_tracks_expiry_needs_an_expiry_date_and_lot(): void
    {
        $this->postJson('/api/inventory', $this->newProduct(['has_expiry' => true]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['expiration_date', 'lot_number']);

        $this->postJson('/api/inventory', $this->newProduct([
            'has_expiry' => true, 'expiration_date' => now()->addYear()->toDateString(), 'lot_number' => 'LOT-77',
        ]))->assertSuccessful();
    }

    public function test_a_product_without_expiry_tracking_needs_neither(): void
    {
        $this->postJson('/api/inventory', $this->newProduct(['code' => 'GAUZE-NEW', 'has_expiry' => false]))->assertSuccessful();
    }

    public function test_receiving_stock_of_a_tracked_product_needs_an_expiry_date_and_lot(): void
    {
        $product = $this->batch('VAX', 5, now()->addMonths(6)->toDateString());

        $this->postJson("/api/inventory/{$product->id}/receive", ['quantity' => 10, 'batch_number' => 'B-2'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['expiration_date', 'lot_number']);

        $this->postJson("/api/inventory/{$product->id}/receive", [
            'quantity' => 10, 'batch_number' => 'B-2', 'expiration_date' => now()->addYear()->toDateString(), 'lot_number' => 'LOT-2',
        ])->assertSuccessful();
    }
}

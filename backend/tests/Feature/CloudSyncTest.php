<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use App\Models\SyncOutbox;
use App\Services\SyncService;
use App\Support\Sync\SyncSignature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Clinic <-> cloud sync. One database plays the part of whichever side is
 * under test: the cloud receiving a push or answering a pull, or the clinic
 * computer sending its queue.
 */
class CloudSyncTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-sync-secret';

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Test Clinic', 'email' => 'clinic@example.com', 'status' => 'active'],
        ]);
        config()->set('services.sync', [
            'is_clinic' => false,
            'accept' => true,
            'portal_url' => 'https://cloud.example.test',
            'secret' => self::SECRET,
            'clinic_id' => 1,
        ]);
    }

    private function signedPush(array $records, ?int $timestamp = null, string $secret = self::SECRET)
    {
        $body = json_encode(['records' => $records], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ts = $timestamp ?? time();

        return $this->call('POST', '/api/sync/push', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_AUTOVET_TIMESTAMP' => (string) $ts,
            'HTTP_X_AUTOVET_SIGNATURE' => SyncSignature::sign($secret, $ts, 'POST', '/api/sync/push', $body),
        ], $body);
    }

    private function signedPull(array $cursor = [])
    {
        $query = ['cursor' => json_encode($cursor, JSON_UNESCAPED_SLASHES)];
        $content = SyncSignature::canonicalQuery($query);
        $ts = time();

        return $this->call('GET', '/api/sync/pull?'.$content, [], [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_AUTOVET_TIMESTAMP' => (string) $ts,
            'HTTP_X_AUTOVET_SIGNATURE' => SyncSignature::sign(self::SECRET, $ts, 'GET', '/api/sync/pull', $content),
        ]);
    }

    private function ownerRecord(string $name, string $updatedAt = '2026-11-12 08:00:00'): array
    {
        return ['data' => [
            'name' => $name, 'phone' => '0917'.random_int(1000000, 9999999), 'email' => null,
            'created_at' => '2026-11-12 08:00:00', 'updated_at' => $updatedAt,
        ], 'refs' => [], 'lookups' => ['user_id' => null, 'deleted_by' => null]];
    }

    // --- Access -------------------------------------------------------------

    public function test_endpoints_do_not_exist_until_the_cloud_accepts_sync(): void
    {
        config()->set('services.sync.accept', false);

        $this->signedPush([])->assertNotFound();
        $this->signedPull()->assertNotFound();
    }

    public function test_a_request_with_the_wrong_secret_is_refused(): void
    {
        $this->signedPush([['type' => 'Owner', 'uuid' => (string) Str::uuid(), 'action' => 'upsert', 'record' => $this->ownerRecord('X')]], null, 'wrong-secret')
            ->assertStatus(401);

        $this->assertSame(0, Owner::withoutGlobalScopes()->count());
    }

    public function test_an_old_request_cannot_be_replayed(): void
    {
        $this->signedPush([], time() - 3600)->assertStatus(401);
    }

    // --- Push: clinic -> cloud ----------------------------------------------

    public function test_links_are_matched_by_uuid_not_by_the_clinics_ids(): void
    {
        // An unrelated owner already here takes id 1, so the clinic's ids would point at the wrong person.
        $stranger = Owner::create(['clinic_id' => 1, 'name' => 'Someone Else', 'phone' => '09110000000']);
        Species::firstOrCreate(['name' => 'Canine']);

        $ownerUuid = (string) Str::uuid();
        $petUuid = (string) Str::uuid();

        // Sent child first on purpose: the cloud applies parents first.
        $response = $this->signedPush([
            ['type' => 'Pet', 'uuid' => $petUuid, 'action' => 'upsert', 'record' => [
                'data' => ['name' => 'Buboy', 'created_at' => '2026-11-12 08:00:00', 'updated_at' => '2026-11-12 08:00:00'],
                'refs' => ['owner_id' => $ownerUuid],
                'lookups' => ['species_id' => ['name' => 'Canine'], 'breed_id' => null, 'size_category_id' => null, 'deleted_by' => null],
            ]],
            ['type' => 'Owner', 'uuid' => $ownerUuid, 'action' => 'upsert', 'record' => $this->ownerRecord('Andrea')],
        ]);

        $response->assertOk()->assertJsonPath('counts.applied', 2);

        $owner = DB::table('owners')->where('uuid', $ownerUuid)->first();
        $pet = DB::table('pets')->where('uuid', $petUuid)->first();
        $this->assertNotSame($stranger->id, $owner->id);
        $this->assertSame($owner->id, $pet->owner_id);
        $this->assertSame(Species::where('name', 'Canine')->value('id'), $pet->species_id);
        $this->assertSame('synced', $pet->sync_status);
    }

    public function test_a_record_whose_parent_never_arrived_is_rejected_not_detached(): void
    {
        $this->signedPush([['type' => 'Pet', 'uuid' => (string) Str::uuid(), 'action' => 'upsert', 'record' => [
            'data' => ['name' => 'Orphan', 'updated_at' => '2026-11-12 08:00:00'],
            'refs' => ['owner_id' => (string) Str::uuid()],
            'lookups' => [],
        ]]])->assertOk()->assertJsonPath('results.0.status', 'error');

        $this->assertSame(0, DB::table('pets')->count());
    }

    public function test_the_latest_edit_wins(): void
    {
        $uuid = (string) Str::uuid();
        $this->signedPush([['type' => 'Owner', 'uuid' => $uuid, 'action' => 'upsert', 'record' => $this->ownerRecord('Edited later', '2026-11-12 10:00:00')]]);

        // An older copy of the same owner arrives afterwards: ignored.
        $this->signedPush([['type' => 'Owner', 'uuid' => $uuid, 'action' => 'upsert', 'record' => $this->ownerRecord('Edited earlier', '2026-11-12 09:00:00')]])
            ->assertJsonPath('results.0.status', 'kept_newer');
        $this->assertSame('Edited later', DB::table('owners')->where('uuid', $uuid)->value('name'));

        // A newer one replaces it.
        $this->signedPush([['type' => 'Owner', 'uuid' => $uuid, 'action' => 'upsert', 'record' => $this->ownerRecord('Edited last', '2026-11-12 11:00:00')]])
            ->assertJsonPath('results.0.status', 'applied');
        $this->assertSame('Edited last', DB::table('owners')->where('uuid', $uuid)->value('name'));
    }

    public function test_an_invoice_number_used_on_both_sides_keeps_both_invoices(): void
    {
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
        $pet = Pet::create(['owner_id' => $owner->id, 'name' => 'Rex', 'species_id' => Species::firstOrCreate(['name' => 'Canine'])->id]);
        DB::table('invoices')->insert([
            'clinic_id' => 1, 'uuid' => (string) Str::uuid(), 'invoice_number' => 'VB-2026-11-0005', 'pet_id' => $pet->id,
            'status' => 'Finalized', 'subtotal' => 100, 'total' => 100, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $uuid = (string) Str::uuid();
        $this->signedPush([['type' => 'Invoice', 'uuid' => $uuid, 'action' => 'upsert', 'record' => [
            'data' => ['invoice_number' => 'VB-2026-11-0005', 'status' => 'Finalized', 'subtotal' => 250, 'total' => 250,
                'created_at' => '2026-11-12 08:00:00', 'updated_at' => '2026-11-12 08:00:00'],
            'refs' => ['pet_id' => $pet->uuid, 'appointment_id' => null],
            'lookups' => [],
        ]]])->assertJsonPath('results.0.status', 'renamed');

        $this->assertSame(2, DB::table('invoices')->count());
        $this->assertSame('VB-2026-11-0005-'.strtoupper(substr($uuid, 0, 4)), DB::table('invoices')->where('uuid', $uuid)->value('invoice_number'));
    }

    // --- Pull: cloud -> clinic ----------------------------------------------

    public function test_pull_returns_changes_after_the_cursor_with_portable_links(): void
    {
        $vet = Admin::factory()->role(Roles::VETERINARIAN->value)->create(['email' => 'vet@example.com']);
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Client', 'phone' => '09111111111']);
        $pet = Pet::create(['owner_id' => $owner->id, 'name' => 'Rex', 'species_id' => Species::firstOrCreate(['name' => 'Canine'])->id]);
        DB::table('pets')->where('id', $pet->id)->update(['updated_at' => '2026-11-12 09:00:00']);
        DB::table('owners')->where('id', $owner->id)->update(['updated_at' => '2026-11-12 09:00:00']);

        $first = $this->signedPull()->assertOk();
        $petRecord = collect($first->json('records'))->firstWhere('type', 'Pet');

        $this->assertSame($owner->uuid, $petRecord['record']['refs']['owner_id']);
        $this->assertSame(['name' => 'Canine'], $petRecord['record']['lookups']['species_id']);
        $this->assertArrayNotHasKey('id', $petRecord['record']['data']);
        $this->assertArrayNotHasKey('owner_id', $petRecord['record']['data']);

        // Nothing changed since: the next pull is empty.
        $this->assertSame([], $this->signedPull($first->json('cursor'))->json('records'));
        unset($vet);
    }

    // --- Clinic side ----------------------------------------------------------

    public function test_the_clinic_sends_its_queue_signed_and_marks_it_synced(): void
    {
        config()->set('services.sync.is_clinic', true);
        $owner = Owner::create(['clinic_id' => 1, 'name' => 'Made offline', 'phone' => '09222222222']);

        Http::fake([
            'cloud.example.test/api/sync/push' => function ($request) {
                $ts = (int) $request->header('X-AutoVet-Timestamp')[0];
                $this->assertSame(
                    SyncSignature::sign(self::SECRET, $ts, 'POST', '/api/sync/push', $request->body()),
                    $request->header('X-AutoVet-Signature')[0]
                );
                $records = $request->data()['records'];

                return Http::response(['results' => array_map(fn ($r) => ['type' => $r['type'], 'uuid' => $r['uuid'], 'status' => 'applied'], $records)]);
            },
            'cloud.example.test/api/sync/pull*' => Http::response(['records' => [], 'cursor' => [], 'more' => false]),
        ]);

        $result = app(SyncService::class)->run();

        $this->assertSame('ok', $result['status']);
        $this->assertSame(0, $result['pending']);
        $this->assertSame('synced', DB::table('owners')->where('id', $owner->id)->value('sync_status'));
        // Marking it synced must not queue it to be sent again.
        $this->assertSame(0, SyncOutbox::whereIn('status', ['pending', 'failed'])->count());
    }

    public function test_without_internet_the_queue_waits_and_no_retries_are_used(): void
    {
        config()->set('services.sync.is_clinic', true);
        Owner::create(['clinic_id' => 1, 'name' => 'Made offline', 'phone' => '09333333333']);

        Http::fake(fn () => throw new ConnectionException('Could not resolve host'));

        $result = app(SyncService::class)->run();

        $this->assertSame('offline', $result['status']);
        $this->assertSame(1, $result['pending']);
        $this->assertSame(0, (int) SyncOutbox::max('retry_count'));
    }
}

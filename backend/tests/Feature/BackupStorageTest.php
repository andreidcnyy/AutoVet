<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BackupStorageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('clinics')->insertOrIgnore([
            ['id' => 1, 'clinic_name' => 'Clinic One', 'email' => 'one@example.com', 'status' => 'active'],
            ['id' => 2, 'clinic_name' => 'Clinic Two', 'email' => 'two@example.com', 'status' => 'active'],
        ]);
        Storage::fake('backups');
    }

    public function test_a_backup_is_written_to_the_backups_disk_in_the_clinic_folder(): void
    {
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => 1]), ['*']);

        $filename = $this->postJson('/api/backups')->assertCreated()->json('backup.filename');

        $this->assertMatchesRegularExpression('/^backup_[\d_]+\.tar\.gz$/', $filename);
        Storage::disk('backups')->assertExists("clinic_1/{$filename}");

        $this->getJson('/api/backups')->assertOk()->assertJsonPath('data.0.filename', $filename);
        $this->get("/api/backups/download/{$filename}")->assertOk();
    }

    public function test_one_clinic_cannot_see_or_download_another_clinics_backup(): void
    {
        Storage::disk('backups')->put('clinic_2/backup_2026_01_01_00_00_00.tar.gz', 'other clinic');
        Sanctum::actingAs(Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => 1]), ['*']);

        $this->getJson('/api/backups')->assertOk()->assertJsonCount(0, 'data');
        $this->get('/api/backups/download/backup_2026_01_01_00_00_00.tar.gz')->assertNotFound();
        $this->deleteJson('/api/backups/backup_2026_01_01_00_00_00.tar.gz')->assertNotFound();
        Storage::disk('backups')->assertExists('clinic_2/backup_2026_01_01_00_00_00.tar.gz');
    }
}

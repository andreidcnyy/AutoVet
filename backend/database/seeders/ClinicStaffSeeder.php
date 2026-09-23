<?php

namespace Database\Seeders;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\Clinic;
use App\Models\VetSchedule;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * The people who staff the clinic, plus the roster they work.
 *
 * Seeded early, because without at least one veterinarian there is nobody an
 * appointment can be assigned to — every later seeder that books a visit would
 * leave vet_id null, and the vet-schedule screen would have no rows to draw.
 */
class ClinicStaffSeeder extends Seeder
{
    public const EMAIL_DOMAIN = '@petwellness.ph';

    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) {
            return;
        }

        $people = [
            ['name' => 'Dr. Maria Santos',    'email' => 'maria.santos',   'role' => Roles::VETERINARIAN],
            ['name' => 'Dr. Ramon Dela Cruz', 'email' => 'ramon.delacruz', 'role' => Roles::VETERINARIAN],
            ['name' => 'Dr. Aileen Reyes',    'email' => 'aileen.reyes',   'role' => Roles::VETERINARIAN],
            ['name' => 'Joy Mendoza',         'email' => 'joy.mendoza',    'role' => Roles::STAFF],
            ['name' => 'Carlo Bautista',      'email' => 'carlo.bautista', 'role' => Roles::STAFF],
        ];

        foreach ($people as $person) {
            Admin::updateOrCreate(
                ['email' => $person['email'] . self::EMAIL_DOMAIN],
                [
                    'name' => $person['name'],
                    'password' => Hash::make('password123'),
                    'role' => $person['role']->value,
                    'status' => 'active',
                    'clinic_id' => $clinic->id,
                ]
            );
        }

        $this->seedSchedules($clinic, self::veterinarians($clinic));
    }

    /** The clinic's veterinarians, in a stable order. */
    public static function veterinarians(Clinic $clinic)
    {
        return Admin::where('clinic_id', $clinic->id)
            ->where('role', Roles::VETERINARIAN->value)
            ->orderBy('id')
            ->get();
    }

    /** A Mon-Sat roster per vet, so the booking screen can offer real slots. */
    private function seedSchedules(Clinic $clinic, $vets): void
    {
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        foreach ($vets as $index => $vet) {
            foreach ($days as $day) {
                // Saturday is a half day, and each vet rests on one weekday, so
                // the roster is not a flat and unrealistic grid.
                $isRestDay = $day === $days[$index % 5];
                $isSaturday = $day === 'Saturday';

                VetSchedule::updateOrCreate(
                    ['clinic_id' => $clinic->id, 'user_id' => $vet->id, 'day_of_week' => $day],
                    [
                        'start_time' => '08:00:00',
                        'end_time' => $isSaturday ? '12:00:00' : '17:00:00',
                        'break_start' => $isSaturday ? null : '12:00:00',
                        'break_end' => $isSaturday ? null : '13:00:00',
                        'is_available' => !$isRestDay,
                        'max_appointments' => $isSaturday ? 8 : 16,
                    ]
                );
            }
        }
    }
}

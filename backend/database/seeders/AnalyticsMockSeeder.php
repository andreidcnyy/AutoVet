<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Owner;
use App\Models\Clinic;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsMockSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::first();
        if (!$clinic) return;

        // Monthly distribution: spread 60 clients across the last 12 months
        // Heavier in recent months to show growth trend
        $distribution = [
            -11 => 2, -10 => 2, -9 => 3, -8 => 3,
            -7  => 4, -6  => 4, -5 => 5, -4 => 5,
            -3  => 6, -2  => 7, -1 => 8, 0  => 11,
        ];

        $index = Owner::max('id') ?? 0;

        foreach ($distribution as $monthOffset => $count) {
            $monthBase = Carbon::now()->startOfMonth()->addMonths($monthOffset);

            for ($i = 0; $i < $count; $i++) {
                $index++;
                $createdAt = $monthBase->copy()->addDays(rand(0, 27))->addHours(rand(8, 18));

                Owner::create([
                    'name'       => "Analytics Client {$index}",
                    'email'      => "analytics.client.{$index}@autovet.demo",
                    'phone'      => '09' . rand(100000000, 999999999),
                    'address'    => 'Metro Manila',
                    'clinic_id'  => $clinic->id,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }
        }

        $this->command->info('AnalyticsMockSeeder: ' . array_sum($distribution) . ' demo clients created across 12 months.');
    }
}

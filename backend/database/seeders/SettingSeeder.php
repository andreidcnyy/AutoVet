<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            ['key' => 'clinic_name', 'value' => 'AutoVet Downtown Clinic'],
            ['key' => 'primary_email', 'value' => 'support@autovetclinic.com'],
            ['key' => 'phone_number', 'value' => '(415) 555-0123'],
            ['key' => 'address', 'value' => '1234 Veterinary Lane, San Francisco, CA 94103'],
            ['key' => 'tax_rate', 'value' => '8.00'],
            ['key' => 'currency', 'value' => 'USD ($)'],
            ['key' => 'invoice_notes_template', 'value' => 'Thank you for trusting {clinic_name} with {pet_name}\'s care. Please continue monthly prevention as prescribed.'],
        ];

        foreach ($settings as $setting) {
            \App\Models\Setting::updateOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value']]
            );
        }
    }
}

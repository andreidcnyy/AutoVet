<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $clinics = DB::table('clinics')->pluck('id');
        if ($clinics->isEmpty()) {
            return;
        }

        $templates = [
            [
                'name' => 'Appointment Reminder',
                'event_key' => 'appointment_reminder',
                'channel' => 'email',
                'subject' => 'Appointment Reminder: {pet_name}',
                'body' => "Hello {owner_name},\n\nThis is a reminder from Pet Wellness Animal Clinic for your scheduled appointment for {pet_name} on {date} at {time}.\n\nWe look forward to seeing you!",
            ],
            [
                'name' => 'Appointment Created',
                'event_key' => 'appointment_created',
                'channel' => 'email',
                'subject' => 'Appointment Received: {pet_name}',
                'body' => "Hello {owner_name},\n\nWe have received your appointment request for {pet_name} on {date}. We will review it and notify you once it is approved.",
            ],
            [
                'name' => 'Appointment Approved',
                'event_key' => 'appointment_approved',
                'channel' => 'email',
                'subject' => 'Appointment Approved: {pet_name}',
                'body' => "Hello {owner_name},\n\nYour appointment request for {pet_name} on {date} at {time} has been approved.\n\nSee you then!",
            ],
            [
                'name' => 'Appointment Declined',
                'event_key' => 'appointment_declined',
                'channel' => 'email',
                'subject' => 'Appointment Declined: {pet_name}',
                'body' => "Hello {owner_name},\n\nWe regret to inform you that your appointment request for {pet_name} on {date} has been declined. Please contact us for more information or to reschedule.",
            ],
            [
                'name' => 'Invoice Finalized',
                'event_key' => 'invoice_finalized',
                'channel' => 'email',
                'subject' => 'Invoice for {pet_name}',
                'body' => "Hello {owner_name},\n\nThe invoice for {pet_name}'s visit on {date} has been finalized. Thank you for choosing Pet Wellness Animal Clinic.",
            ],
            [
                'name' => 'Medical Summary Notice',
                'event_key' => 'medical_summary_notice',
                'channel' => 'email',
                'subject' => 'Medical Record Summary: {pet_name}',
                'body' => "Hello {owner_name},\n\nA medical record summary for {pet_name} is now available. \n\nDiagnosis: {diagnosis}\n\nFindings: {findings}",
            ],
        ];

        $now = now();

        foreach ($clinics as $clinicId) {
            foreach ($templates as $tpl) {
                $exists = DB::table('notification_templates')
                    ->where('clinic_id', $clinicId)
                    ->where('event_key', $tpl['event_key'])
                    ->where('channel', $tpl['channel'])
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('notification_templates')->insert(array_merge($tpl, [
                    'clinic_id' => $clinicId,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }

    public function down(): void
    {
        // Intentionally a no-op: removing seeded templates would silently break
        // notification sending across clinics that depend on them.
    }
};

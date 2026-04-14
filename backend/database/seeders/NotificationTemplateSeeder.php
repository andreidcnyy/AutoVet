<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\NotificationTemplate;

class NotificationTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Appointment Reminder',
                'event_key' => 'appointment_reminder',
                'channel' => 'email',
                'subject' => 'Appointment Reminder: {pet_name}',
                'body' => "Hello {owner_name},\n\nThis is a reminder from Pet Wellness Animal Clinic for your scheduled appointment for {pet_name} on {date} at {time}.\n\nWe look forward to seeing you!",
                'is_active' => true,
            ],
            [
                'name' => 'Appointment Created',
                'event_key' => 'appointment_created',
                'channel' => 'email',
                'subject' => 'Appointment Received: {pet_name}',
                'body' => "Hello {owner_name},\n\nWe have received your appointment request for {pet_name} on {date}. We will review it and notify you once it is approved.",
                'is_active' => true,
            ],
            [
                'name' => 'Appointment Approved',
                'event_key' => 'appointment_approved',
                'channel' => 'email',
                'subject' => 'Appointment Approved: {pet_name}',
                'body' => "Hello {owner_name},\n\nYour appointment request for {pet_name} on {date} at {time} has been approved.\n\nSee you then!",
                'is_active' => true,
            ],
            [
                'name' => 'Appointment Declined',
                'event_key' => 'appointment_declined',
                'channel' => 'email',
                'subject' => 'Appointment Declined: {pet_name}',
                'body' => "Hello {owner_name},\n\nWe regret to inform you that your appointment request for {pet_name} on {date} has been declined. Please contact us for more information or to reschedule.",
                'is_active' => true,
            ],
            [
                'name' => 'Invoice Finalized',
                'event_key' => 'invoice_finalized',
                'channel' => 'email',
                'subject' => 'Invoice for {pet_name}',
                'body' => "Hello {owner_name},\n\nThe invoice for {pet_name}'s visit on {date} has been finalized. Thank you for choosing Pet Wellness Animal Clinic.",
                'is_active' => true,
            ],
            [
                'name' => 'Medical Summary Notice',
                'event_key' => 'medical_summary_notice',
                'channel' => 'email',
                'subject' => 'Medical Record Summary: {pet_name}',
                'body' => "Hello {owner_name},\n\nA medical record summary for {pet_name} is now available. \n\nDiagnosis: {diagnosis}\n\nFindings: {findings}",
                'is_active' => true,
            ],
        ];

        foreach ($templates as $template) {
            NotificationTemplate::updateOrCreate(
                ['event_key' => $template['event_key'], 'channel' => $template['channel']],
                $template
            );
        }
    }
}

<?php

namespace App\Services;

use App\Models\ClientNotification;
use App\Models\NotificationTemplate;
use App\Models\Owner;
use App\Services\Sms\SmsProviderInterface;
use Illuminate\Support\Facades\Mail;
use App\Mail\ClientNotificationMail;

class ClientNotificationService
{
    protected SmsProviderInterface $smsProvider;

    public function __construct(SmsProviderInterface $smsProvider)
    {
        $this->smsProvider = $smsProvider;
    }

    /**
     * Send a notification to an owner using a template.
     */
    public function sendFromTemplate(Owner $owner, string $eventKey, string $channel, array $variables = [], ?string $type = 'automated', $relatedModel = null)
    {
        $template = NotificationTemplate::where('event_key', $eventKey)
            ->where('channel', $channel)
            ->where('is_active', true)
            ->first();

        if (!$template) {
            throw new \Exception("No active $channel template found for event '$eventKey'.");
        }

        $subject = $this->interpolateVariables($template->subject ?? '', $variables, $owner);
        $body = $this->interpolateVariables($template->body, $variables, $owner);

        return $this->send($owner, $channel, $body, $subject, $type, $relatedModel);
    }

    /**
     * Send a notification directly.
     */
    public function send(Owner $owner, string $channel, string $message, ?string $title = null, ?string $type = 'manual', $relatedModel = null)
    {
        $notification = ClientNotification::create([
            'owner_id' => $owner->id,
            'channel' => $channel,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'status' => 'pending',
            'related_type' => $relatedModel ? get_class($relatedModel) : null,
            'related_id' => $relatedModel ? $relatedModel->id : null,
        ]);

        try {
            if ($channel === 'email') {
                if (empty($owner->email)) {
                    throw new \Exception("Owner has no email address.");
                }
                Mail::to($owner->email)->send(new ClientNotificationMail($title ?? 'Notification', $message));
            } elseif ($channel === 'sms') {
                if (empty($owner->phone)) {
                    throw new \Exception("Owner has no phone number.");
                }
                $this->smsProvider->sendSms($owner->phone, $message);
            } else {
                throw new \Exception("Unsupported notification channel: $channel");
            }

            $notification->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            return $notification;

        } catch (\Exception $e) {
            $notification->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e; // Re-throw to inform frontend or caller
        }
    }

    /**
     * Interpolate variables in a string.
     */
    public function interpolateVariables(string $text, array $variables, ?Owner $owner = null, $relatedModel = null): string
    {
        if ($owner) {
            $variables['owner_name'] = $owner->name;
        }

        if ($relatedModel instanceof \App\Models\Appointment) {
            $variables['date_scheduled'] = $relatedModel->date;
            $variables['arrival_time'] = $relatedModel->time;
            $variables['patient'] = $relatedModel->pet->name ?? 'Pet';
        }

        if ($relatedModel instanceof \App\Models\MedicalRecord) {
            $variables['patient'] = $relatedModel->pet->name ?? 'Pet';
            $variables['findings'] = $relatedModel->findings;
            $variables['diagnosis'] = $relatedModel->diagnosis;
        }

        foreach ($variables as $key => $value) {
            $text = str_replace('{' . $key . '}', $value, $text);
        }

        return $text;
    }
}

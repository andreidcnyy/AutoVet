<?php

namespace App\Services\Sms;

interface SmsProviderInterface
{
    /**
     * Send an SMS message to a specific phone number.
     *
     * @param string $to
     * @param string $message
     * @return bool True if successfully queued/sent, false otherwise
     */
    public function sendSms(string $to, string $message): bool;
}

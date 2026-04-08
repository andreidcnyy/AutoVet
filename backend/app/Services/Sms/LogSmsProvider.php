<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

class LogSmsProvider implements SmsProviderInterface
{
    /**
     * Mock sending an SMS by logging it.
     */
    public function sendSms(string $to, string $message): bool
    {
        Log::channel('single')->info('MOCK SMS SENT', [
            'to' => $to,
            'message' => $message,
            'status' => 'success'
        ]);

        return true;
    }
}

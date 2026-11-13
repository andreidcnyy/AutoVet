<?php

namespace App\Jobs;

use App\Models\ClientNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Sends one email outside the request that asked for it.
 *
 * Every send used to call Brevo inside the request: booking an appointment
 * waited 2-10 seconds on the API before answering, and when the call failed
 * or the request was cut off the email was simply gone. Now the request only
 * records the email and answers; the send happens afterwards and a failed
 * send is retried.
 */
class SendEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** Seconds to wait before the second and third attempts. */
    public array $backoff = [15, 60];

    public int $timeout = 60;

    public function __construct(
        public string $mailer,
        public string $to,
        public Mailable $mail,
        public ?int $notificationId = null,
    ) {}

    /**
     * Hands the email off without waiting for it to send.
     *
     * With MAIL_ASYNC on (production, see the Dockerfile) it goes to the "mail"
     * queue, which a worker started next to the web server drains. Otherwise
     * it is sent in the same process right after the response has gone out,
     * so a machine with no queue worker running still delivers it.
     */
    public static function deliver(string $mailer, string $to, Mailable $mail, ?int $notificationId = null): void
    {
        $job = new self($mailer, $to, $mail, $notificationId);

        if (config('mail.async')) {
            dispatch($job)->onConnection('database')->onQueue('mail')->afterCommit();

            return;
        }

        app()->terminating(function () use ($job) {
            try {
                $job->handle();
            } catch (\Throwable $e) {
                $job->failed($e);
            }
        });
    }

    public function handle(): void
    {
        Mail::mailer($this->mailer)->to($this->to)->send($this->mail);

        if ($this->notificationId) {
            ClientNotification::withoutGlobalScopes()->whereKey($this->notificationId)->update([
                'status' => 'sent',
                'sent_at' => now(),
                'failed_at' => null,
                'error_message' => null,
            ]);
        }
    }

    /** Called once every attempt has failed. */
    public function failed(\Throwable $e): void
    {
        Log::error("Email via [{$this->mailer}] to [{$this->to}] failed: ".$e->getMessage());

        if ($this->notificationId) {
            ClientNotification::withoutGlobalScopes()->whereKey($this->notificationId)->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_message' => mb_substr($e->getMessage(), 0, 1000),
            ]);
        }
    }
}

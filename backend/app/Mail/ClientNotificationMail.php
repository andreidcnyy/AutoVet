<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ClientNotificationMail extends Mailable
{
    use SerializesModels;

    public $messageSubject;
    public $messageBody;

    /**
     * Create a new message instance.
     */
    public function __construct(string $messageSubject, string $messageBody)
    {
        $this->messageSubject = $messageSubject;
        $this->messageBody = $messageBody;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject($this->messageSubject)
                    ->view('emails.client.basic_notification')
                    ->with([
                        'body' => $this->messageBody,
                    ]);
    }
}

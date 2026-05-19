<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class InventoryExpiryAlertMail extends Mailable
{
    public function __construct(
        private readonly string $alertSubject,
        private readonly string $htmlBody
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->alertSubject);
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->htmlBody);
    }
}

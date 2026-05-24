<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReviewRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public $owner;
    public $invoice;
    public $clinicName;
    public $portalUrl;

    public function __construct($owner, $invoice)
    {
        $this->owner      = $owner;
        $this->invoice    = $invoice;
        $settings         = \App\Models\Setting::all()->pluck('value', 'key');
        $this->clinicName = $settings['clinic_name'] ?? config('app.name');
        $this->portalUrl  = config('app.portal_url', env('PORTAL_URL', 'https://autovet-portal.vercel.app'));
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'How was your visit? Share your feedback — ' . $this->clinicName,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.review_request',
        );
    }
}

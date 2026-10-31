<?php

namespace App\Mail;

use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public $invoice;

    public $clinic;

    /**
     * Create a new message instance.
     */
    public function __construct($invoice, $clinic = null)
    {
        $this->invoice = $invoice;
        if (! $clinic) {
            $settings = Setting::all()->pluck('value', 'key');
            $this->clinic = (object) [
                'clinic_name' => $settings['clinic_name'] ?? config('app.name'),
                'address' => $settings['clinic_address'] ?? '',
                'phone_number' => $settings['clinic_phone'] ?? '',
                'clinic_logo' => $settings['clinic_logo'] ?? null,
            ];
        } else {
            $this->clinic = $clinic;
        }
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invoice #'.($this->invoice->invoice_number ?? $this->invoice->id).' from '.($this->clinic->clinic_name ?? config('app.name')),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $pdf = Pdf::loadView('emails.invoice', [
            'invoice' => $this->invoice,
            'clinic' => $this->clinic,
        ]);

        return [
            Attachment::fromData(fn () => $pdf->output(), 'Invoice-'.($this->invoice->invoice_number ?? $this->invoice->id).'.pdf')
                ->withMime('application/pdf'),
        ];
    }
}

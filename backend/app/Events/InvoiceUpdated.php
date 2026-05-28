<?php

namespace App\Events;

use App\Models\Invoice;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InvoiceUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $invoice;

    public function __construct(Invoice $invoice)
    {
        $this->invoice = $invoice->load(['pet.owner', 'items']);
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('admin.invoices'),
        ];

        if ($this->invoice->pet?->owner?->user_id) {
            $channels[] = new PrivateChannel('client.invoices.' . $this->invoice->pet->owner->user_id);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'invoice.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id'             => $this->invoice->id,
            'invoice_number' => $this->invoice->invoice_number,
            'status'         => $this->invoice->status,
            'total'          => $this->invoice->total,
        ];
    }
}

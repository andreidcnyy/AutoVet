<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; margin: 0; padding: 0; background-color: #f1f5f9; }
        .wrapper { width: 100%; padding: 40px 0; }
        .invoice-card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden; }
        .header-stripe { height: 8px; background: #10b981; }
        .content { padding: 40px; }
        .top-row { margin-bottom: 40px; }
        .brand h1 { margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -1px; }
        .brand p { margin: 2px 0; font-size: 12px; color: #64748b; font-weight: 600; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { margin: 0; font-size: 32px; font-weight: 900; color: #e2e8f0; letter-spacing: -1px; }
        .invoice-meta p { margin: 2px 0; font-size: 14px; font-weight: 700; color: #1e293b; }
        .info-grid { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
        .info-grid td { vertical-align: top; width: 50%; }
        .label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .val { font-size: 14px; font-weight: 700; color: #1e293b; }
        .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
        .table th { text-align: left; padding: 12px; background: #f8fafc; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        .table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .totals-table { width: 250px; margin-left: auto; border-collapse: collapse; }
        .totals-table td { padding: 8px 12px; font-size: 14px; }
        .grand-total { background: #f8fafc; border-top: 2px solid #10b981; }
        .grand-total td { padding: 16px 12px; font-size: 18px; font-weight: 900; color: #10b981; }
        .footer { padding: 30px 40px; background: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="invoice-card">
            <div class="header-stripe"></div>
            <div class="content">
                <table style="width:100%; margin-bottom: 40px;">
                    <tr>
                        <td>
                            <div class="brand">
                                <h1>{{ $clinic->clinic_name ?? 'Pet Wellness' }}</h1>
                                <p>{{ $clinic->address ?? 'Clinic Address' }}</p>
                                <p>{{ $clinic->phone_number ?? 'Contact Info' }}</p>
                            </div>
                        </td>
                        <td style="text-align: right;">
                            <div class="invoice-meta">
                                <h2>INVOICE</h2>
                                <p>#{{ $invoice->invoice_number }}</p>
                                <p style="color: #64748b; font-size: 12px;">{{ \Carbon\Carbon::parse($invoice->created_at)->format('F d, Y') }}</p>
                            </div>
                        </td>
                    </tr>
                </table>

                <table class="info-grid">
                    <tr>
                        <td>
                            <div class="label">Client / Owner</div>
                            <div class="val">{{ $invoice->pet->owner->name ?? 'Valued Client' }}</div>
                            <div style="font-size: 12px; color: #64748b; font-weight: 500; margin-top: 2px;">
                                Patient: {{ $invoice->pet->name }} ({{ $invoice->pet->breed->name ?? $invoice->pet->species->name }})
                            </div>
                        </td>
                        <td style="text-align: right;">
                            <div class="label">Status</div>
                            <div class="val" style="color: {{ in_array($invoice->status, ['Paid', 'Finalized']) ? '#10b981' : '#f59e0b' }}">{{ $invoice->status }}</div>
                        </td>
                    </tr>
                </table>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Unit Price</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($invoice->items as $item)
                            @if(!$item->is_hidden)
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: #1e293b;">{{ $item->name }}</div>
                                    @if($item->notes)<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">{{ $item->notes }}</div>@endif
                                </td>
                                <td style="text-align: center; color: #64748b; font-weight: 600;">{{ $item->qty }}</td>
                                <td style="text-align: right; color: #64748b;">₱{{ number_format($item->unit_price, 2) }}</td>
                                <td style="text-align: right; font-weight: 700; color: #1e293b;">₱{{ number_format($item->amount, 2) }}</td>
                            </tr>
                            @endif
                        @endforeach
                    </tbody>
                </table>

                <table class="totals-table">
                    <tr>
                        <td style="color: #64748b; font-weight: 600;">Subtotal</td>
                        <td style="text-align: right; font-weight: 700; color: #1e293b;">₱{{ number_format($invoice->subtotal, 2) }}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; font-weight: 600;">VAT (12%)</td>
                        <td style="text-align: right; font-weight: 700; color: #1e293b;">₱{{ number_format($invoice->total - $invoice->subtotal, 2) }}</td>
                    </tr>
                    <tr class="grand-total">
                        <td style="font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total</td>
                        <td style="text-align: right;">₱{{ number_format($invoice->total, 2) }}</td>
                    </tr>
                </table>

                @if($invoice->notes_to_client)
                <div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #e2e8f0;">
                    <div class="label">Notes</div>
                    <div style="font-size: 13px; color: #475569; font-style: italic; margin-top: 4px;">{{ $invoice->notes_to_client }}</div>
                </div>
                @endif
            </div>
            <div class="footer">
                <p>Powered by Pet Wellness Systems</p>
            </div>
        </div>
    </div>
</body>
</html>

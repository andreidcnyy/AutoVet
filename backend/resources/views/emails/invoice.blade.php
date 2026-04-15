<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .invoice-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; background-color: #ffffff; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
        .clinic-info { text-align: left; }
        .invoice-meta { text-align: right; }
        .title { color: #1e293b; margin: 0; font-size: 24px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .table td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
        .footer { font-size: 11px; color: #94a3b8; margin-top: 30px; text-align: center; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .paid { background-color: #ecfdf5; color: #059669; }
        .pending { background-color: #fffbeb; color: #d97706; }
    </style>
</head>
<body>
    <div class="container">
        <div class="invoice-box">
            <div class="header">
                <div class="clinic-info">
                    <h2 style="margin:0; color:#1e293b;">{{ $clinic->clinic_name ?? 'AutoVet Clinic' }}</h2>
                    <p style="margin:4px 0; font-size:12px; color:#64748b;">{{ $clinic->address ?? '' }}</p>
                    <p style="margin:0; font-size:12px; color:#64748b;">{{ $clinic->phone_number ?? '' }}</p>
                </div>
                <div class="invoice-meta">
                    <h1 class="title">INVOICE</h1>
                    <p style="margin:4px 0; font-size:14px; font-weight:bold; color:#334155;">#{{ $invoice->invoice_number ?? $invoice->id }}</p>
                    <p style="margin:0; font-size:12px; color:#64748b;">{{ \Carbon\Carbon::parse($invoice->created_at)->format('M d, Y') }}</p>
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <p style="font-size:11px; font-weight:bold; color:#94a3b8; text-transform:uppercase; margin-bottom:8px;">Bill To</p>
                <p style="margin:0; font-weight:bold; color:#1e293b; font-size:16px;">{{ $invoice->pet->owner->name ?? 'Valued Client' }}</p>
                <p style="margin:2px 0; font-size:13px; color:#64748b;">{{ $invoice->pet->name ?? 'Patient' }} ({{ $invoice->pet->breed->name ?? $invoice->pet->species->name ?? '' }})</p>
            </div>

            <table class="table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center; width: 60px;">Qty</th>
                        <th style="text-align: right; width: 100px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($invoice->items as $item)
                    <tr>
                        <td>
                            <div style="font-weight:bold; color:#334155;">{{ $item->name }}</div>
                            @if($item->notes)<div style="font-size:11px; color:#94a3b8;">{{ $item->notes }}</div>@endif
                        </td>
                        <td style="text-align: center;">{{ $item->qty }}</td>
                        <td style="text-align: right;">P {{ number_format($item->amount, 2) }}</td>
                    </tr>
                    @endforeach
                    <tr>
                        <td colspan="2" style="text-align: right; padding-top: 20px; font-size: 13px; color: #64748b; border:none;">Subtotal</td>
                        <td style="text-align: right; padding-top: 20px; font-size: 13px; color: #334155; border:none;">P {{ number_format($invoice->subtotal, 2) }}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="text-align: right; padding-top: 5px; font-size: 13px; color: #64748b; border:none;">VAT (12%)</td>
                        <td style="text-align: right; padding-top: 5px; font-size: 13px; color: #334155; border:none;">P {{ number_format($invoice->subtotal * 0.12, 2) }}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2" style="text-align: right; border:none;">TOTAL DUE</td>
                        <td style="text-align: right; color: #2563eb; border:none;">P {{ number_format($invoice->total, 2) }}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed #e2e8f0;">
                <span class="status-badge {{ $invoice->status === 'Paid' ? 'paid' : 'pending' }}">
                    Status: {{ $invoice->status }}
                </span>
            </div>

            @if($invoice->notes_to_client)
            <div style="margin-top: 20px;">
                <p style="font-size:11px; font-weight:bold; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">Notes</p>
                <p style="margin:0; font-size:13px; color:#64748b; font-style:italic;">{{ $invoice->notes_to_client }}</p>
            </div>
            @endif
        </div>

        <div class="footer">
            This is an automatically generated invoice. No signature required. <br>
            Powered by AutoVet Systems &bull; 2026
        </div>
    </div>
</body>
</html>

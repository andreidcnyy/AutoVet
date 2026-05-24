<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background: #f8fafc; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .top-bar { height: 6px; background: linear-gradient(90deg, #10b981, #059669); }
        .body { padding: 40px; }
        .header { text-align: center; margin-bottom: 32px; }
        .clinic-name { font-size: 20px; font-weight: 900; color: #1e293b; margin: 0; }
        .tagline { color: #64748b; font-size: 13px; margin-top: 4px; }
        .stars { font-size: 32px; color: #fbbf24; letter-spacing: 4px; text-align: center; margin: 24px 0 8px; }
        .heading { font-size: 22px; font-weight: 900; color: #1e293b; text-align: center; margin: 0 0 12px; }
        .subtext { color: #64748b; font-size: 14px; text-align: center; margin: 0 0 32px; }
        .invoice-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; margin-bottom: 32px; }
        .invoice-box p { margin: 0; font-size: 13px; color: #15803d; font-weight: 600; }
        .button-wrap { text-align: center; margin: 32px 0; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 900; font-size: 15px; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; padding: 24px 40px; border-top: 1px solid #f1f5f9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="top-bar"></div>
        <div class="body">
            <div class="header">
                <p class="clinic-name">{{ $clinicName }}</p>
                <p class="tagline">We care about your pet &amp; your experience</p>
            </div>

            <div class="stars">★★★★★</div>
            <h1 class="heading">How was your visit?</h1>
            <p class="subtext">
                Hi {{ $owner->name }}, thank you for trusting us with {{ $invoice->pet->name ?? 'your pet' }}'s care.<br>
                Your feedback helps us improve and helps other pet owners find us.
            </p>

            <div class="invoice-box">
                <p>Invoice #{{ $invoice->invoice_number ?? $invoice->id }} &nbsp;·&nbsp; {{ $invoice->pet->name ?? '' }} &nbsp;·&nbsp; {{ $invoice->status }}</p>
            </div>

            <div class="button-wrap">
                <a href="{{ $portalUrl }}" class="button">Leave a Review</a>
            </div>

            <p style="font-size:13px;color:#94a3b8;text-align:center;">
                Log in to your portal account and you'll see a quick review form waiting for you.
            </p>
        </div>
        <div class="footer">
            &copy; {{ date('Y') }} {{ $clinicName }}. You received this email because you have an account with us.
        </div>
    </div>
</body>
</html>

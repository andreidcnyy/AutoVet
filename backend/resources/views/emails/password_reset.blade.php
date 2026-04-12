<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #334155; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { color: #1e293b; margin-bottom: 0; }
        .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { font-size: 12px; color: #94a3b8; margin-top: 40px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">AUTOVET Management</h1>
            <p class="subtitle">Pet Wellness Animal Clinic</p>
        </div>
        <p>Hello,</p>
        <p>You are receiving this email because we received a password reset request for your account.</p>
        <div style="text-align: center;">
            <a href="{{ $resetUrl }}" class="button">Reset Password</a>
        </div>
        <p>This password reset link will expire in 60 minutes.</p>
        <p>If you did not request a password reset, no further action is required.</p>
        <p>Regards,<br>AutoVet Clinic Team</p>
        <div class="footer">
            &copy; 2026 AutoVet Clinic. If you're having trouble clicking the "Reset Password" button, copy and paste the URL below into your web browser:<br>
            <span style="word-break: break-all;">{{ $resetUrl }}</span>
        </div>
    </div>
</body>
</html>

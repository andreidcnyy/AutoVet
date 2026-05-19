<?php

namespace App\Console\Commands;

use App\Mail\InventoryExpiryAlertMail;
use App\Models\Admin;
use App\Models\Inventory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class CheckExpiringInventory extends Command
{
    protected $signature = 'inventory:check-expiry';
    protected $description = 'Send email alerts for inventory items expiring within 30 days';

    public function handle()
    {
        $today    = now()->toDateString();
        $warn30   = now()->addDays(30)->toDateString();
        $warn14   = now()->addDays(14)->toDateString();
        $warn7    = now()->addDays(7)->toDateString();

        $expiring = Inventory::whereNotNull('expiration_date')
            ->whereBetween('expiration_date', [$today, $warn30])
            ->where('stock_level', '>', 0)
            ->get();

        if ($expiring->isEmpty()) {
            $this->info('No expiring items found.');
            return 0;
        }

        // Group by urgency
        $urgent   = $expiring->filter(fn($i) => $i->expiration_date->toDateString() <= $warn7);
        $warning  = $expiring->filter(fn($i) => $i->expiration_date->toDateString() > $warn7 && $i->expiration_date->toDateString() <= $warn14);
        $upcoming = $expiring->filter(fn($i) => $i->expiration_date->toDateString() > $warn14);

        // Get all admin emails to notify
        $admins = Admin::whereIn('role', ['admin', 'super_admin'])
            ->whereNotNull('email')
            ->pluck('email')
            ->toArray();

        if (empty($admins)) {
            $this->warn('No admin emails found to notify.');
            return 0;
        }

        $html = $this->buildEmailHtml($urgent, $warning, $upcoming);

        $subject = 'Inventory Expiry Alert - ' . $expiring->count() . ' item(s) expiring within 30 days';

        foreach ($admins as $email) {
            try {
                Mail::mailer('brevo')->to($email)->send(new InventoryExpiryAlertMail($subject, $html));
            } catch (\Exception $e) {
                $this->warn("Failed to email {$email}: " . $e->getMessage());
            }
        }

        $this->info("Expiry alert sent to " . count($admins) . " admin(s) for " . $expiring->count() . " item(s).");
        return 0;
    }

    private function buildEmailHtml($urgent, $warning, $upcoming): string
    {
        $rows = fn($items, $color, $label) => $items->map(fn($i) =>
            "<tr>
              <td style='padding:8px 12px;border-bottom:1px solid #f0f0f0'>{$i->item_name}</td>
              <td style='padding:8px 12px;border-bottom:1px solid #f0f0f0'>{$i->stock_level} {$i->unit}</td>
              <td style='padding:8px 12px;border-bottom:1px solid #f0f0f0'>{$i->expiration_date->format('M d, Y')}</td>
              <td style='padding:8px 12px;border-bottom:1px solid #f0f0f0'>
                <span style='background:{$color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold'>{$label}</span>
              </td>
            </tr>"
        )->implode('');

        $urgentRows   = $rows($urgent,   '#dc2626', 'Expires ≤7 days');
        $warningRows  = $rows($warning,  '#d97706', 'Expires ≤14 days');
        $upcomingRows = $rows($upcoming, '#2563eb', 'Expires ≤30 days');

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800">⚠️ Inventory Expiry Alert</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">The following items are expiring within the next 30 days.</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Item</th>
            <th style="text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Stock</th>
            <th style="text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Expires</th>
            <th style="text-align:left;padding:8px 12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Urgency</th>
          </tr>
        </thead>
        <tbody>
          {$urgentRows}{$warningRows}{$upcomingRows}
        </tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        This is an automated alert from your AutoVet clinic system. Please review and dispose of or use expiring items promptly.
      </p>
    </div>
  </div>
</body>
</html>
HTML;
    }
}

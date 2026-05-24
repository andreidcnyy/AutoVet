<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use App\Mail\InventoryExpiryAlertMail;
use App\Models\Admin;
use App\Enums\Roles;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendLowStockNotification
{
    public function handle(LowStockDetected $event): void
    {
        $enabled = \App\Models\Setting::where('key', 'enable_low_stock_alerts')->value('value');
        if ($enabled === 'false') return;

        $item = $event->inventoryItem;

        $outOfStock = $item->stock_level <= 0;
        $urgencyLabel = $outOfStock ? 'OUT OF STOCK' : 'LOW STOCK';
        $urgencyColor = $outOfStock ? '#dc2626' : '#d97706';

        // In-app notification
        \App\Models\Notification::create([
            'clinic_id' => $item->clinic_id,
            'type'    => 'LowStockAlert',
            'title'   => $urgencyLabel,
            'message' => "{$item->item_name} (SKU: {$item->sku}) is now at {$item->stock_level} units (threshold: {$item->min_stock_level})",
            'data'    => [
                'inventory_id'   => $item->id,
                'stock_level'    => $item->stock_level,
                'min_stock_level'=> $item->min_stock_level,
            ],
        ]);

        // Email clinic admins immediately
        $emails = Admin::where('clinic_id', $item->clinic_id)
            ->whereIn('role', [Roles::CLINIC_ADMIN->value])
            ->whereNotNull('email')
            ->pluck('email')
            ->toArray();

        if (empty($emails)) return;

        $clinicName = \App\Models\Clinic::find($item->clinic_id)?->clinic_name ?? 'AutoVet';
        $subject = "[{$urgencyLabel}] {$item->item_name} — {$clinicName} Inventory Alert";
        $html = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:800">⚠️ Inventory {$urgencyLabel}</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">This alert was triggered by a stock transaction.</p>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#f8fafc">
          <td style="padding:10px 14px;font-weight:700;color:#374151">Item</td>
          <td style="padding:10px 14px;color:#111827">{$item->item_name}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:700;color:#374151">SKU</td>
          <td style="padding:10px 14px;color:#111827">{$item->sku}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:10px 14px;font-weight:700;color:#374151">Current Stock</td>
          <td style="padding:10px 14px">
            <span style="background:{$urgencyColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">{$item->stock_level} units</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:700;color:#374151">Minimum Threshold</td>
          <td style="padding:10px 14px;color:#111827">{$item->min_stock_level} units</td>
        </tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;line-height:1.6">
        This alert was sent automatically when a transaction reduced this item's stock to or below its minimum threshold. Please restock promptly.
      </p>
    </div>
  </div>
</body>
</html>
HTML;

        foreach ($emails as $email) {
            try {
                Mail::mailer('brevo')->to($email)->send(new InventoryExpiryAlertMail($subject, $html));
            } catch (\Exception $e) {
                Log::warning("[LowStock] Failed to email {$email}: " . $e->getMessage());
            }
        }
    }
}

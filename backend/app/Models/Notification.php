<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class Notification extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(Admin::class);
    }

    /** Types the bell generates repeatedly for the same item. */
    public const SELF_CLEARING_TYPES = ['AiForecastUpdate', 'LowStockAlert'];

    /**
     * Marks earlier unread alerts of this type for this item as read.
     *
     * The forecaster and the low-stock listener re-fire for the same item on
     * every run, and each fire used to leave another unread row behind. A
     * handful of items would fill the bell within a day and bury everything
     * genuinely new. Only the newest alert per item is worth showing: the older
     * ones describe the same situation with staler numbers.
     */
    public static function supersedeUnreadFor(string $type, ?int $clinicId, ?int $inventoryId): int
    {
        if (!$inventoryId) {
            return 0;
        }

        return static::query()
            ->where('type', $type)
            ->whereNull('read_at')
            ->when($clinicId, fn ($q) => $q->where('clinic_id', $clinicId))
            ->where('data->inventory_id', $inventoryId)
            ->update(['read_at' => now()]);
    }

    /**
     * Clears machine-generated alerts left unread past $days.
     *
     * A stock warning nobody acted on within a week is no longer news, and
     * leaving it in the bell only hides what is. Human-facing notifications
     * (appointments, invoices) are never touched.
     */
    public static function autoClearStale(int $days = 7): int
    {
        return static::query()
            ->whereIn('type', self::SELF_CLEARING_TYPES)
            ->whereNull('read_at')
            ->where('created_at', '<', now()->subDays($days))
            ->update(['read_at' => now()]);
    }
}

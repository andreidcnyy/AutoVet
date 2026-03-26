<?php

namespace App\Services;

use App\Models\Inventory;
use Illuminate\Support\Str;

class SkuGeneratorService
{
    /**
     * Map categories to their defined prefixes.
     */
    protected const PREFIX_MAP = [
        'Medicines' => 'MED',
        'Vaccines' => 'VAC',
        'Consumables' => 'CON',
        'Retail' => 'RET',
        'Supplies' => 'SUP',
        'Clinic assets' => 'AST',
    ];

    /**
     * Generate a unique SKU for an inventory item.
     * Format: PREFIX-CODE-[VARIANT]-001
     */
    public function generate(string $category, string $itemName, ?string $subDetails = null): string
    {
        $prefix = self::PREFIX_MAP[$category] ?? 'GEN';
        
        // Generate item code: first 4 alphanumeric characters of the name, slugified
        $itemCode = strtoupper(substr(Str::slug($itemName, ''), 0, 4));
        if (empty($itemCode)) $itemCode = 'ITEM';

        $baseSku = "{$prefix}-{$itemCode}";

        // Add optional variant code from sub_details
        if ($subDetails) {
            $variantCode = strtoupper(substr(Str::slug($subDetails, ''), 0, 4));
            if (!empty($variantCode)) {
                $baseSku .= "-{$variantCode}";
            }
        }

        // Find the next available numeric suffix
        $pattern = "{$baseSku}-%";
        $latestSku = Inventory::where('sku', 'like', $pattern)
            ->orderBy('sku', 'desc')
            ->first();

        if ($latestSku) {
            // Extract the last numeric part
            $parts = explode('-', $latestSku->sku);
            $lastPart = end($parts);
            
            if (is_numeric($lastPart)) {
                $nextNumber = intval($lastPart) + 1;
            } else {
                $nextNumber = 1;
            }
        } else {
            $nextNumber = 1;
        }

        return "{$baseSku}-" . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    }
}

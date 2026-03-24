<?php

namespace App\Services;

use App\Models\Service;
use App\Models\Pet;
use App\Models\ServicePrice;

class PricingService
{
    /**
     * Calculate the price for a service given a pet.
     */
    public function calculatePrice(Service $service, ?Pet $pet = null, float $quantity = 1, ?float $manualPrice = null): float
    {
        if ($service->pricing_mode === 'manual' && $manualPrice !== null) {
            return $manualPrice * $quantity;
        }

        if ($service->pricing_mode === 'size_based' && isset($pet)) {
            $petSize = $pet->size_class;
            $priceRecord = $service->sizePrices()
                ->where('size_class', $petSize)
                ->first();
            
            return ($priceRecord ? (float) $priceRecord->price : (float) $service->price) * $quantity;
        }

        // Default or fixed price
        return ($service->price ?? 0) * $quantity;
    }

    /**
     * Validate an item's price against system rules.
     */
    public function validatePrice(Service $service, float $submittedUnitPrice, ?Pet $pet = null): bool
    {
        if ($service->pricing_mode === 'manual') {
            return true;
        }

        $expectedPrice = $this->calculatePrice($service, $pet);
        
        // Allow for minor floating point differences if any, or strict equality
        return abs($expectedPrice - $submittedUnitPrice) < 0.01;
    }
}

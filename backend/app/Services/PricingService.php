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
        if ($service->pricing_mode === 'manual' && $manualPrice !== null) { // Legacy check
            return $manualPrice * $quantity;
        }

        if ($service->pricing_type === 'fixed') {
            return ($service->base_price ?? $service->price ?? 0) * $quantity;
        }

        if ($service->pricing_type === 'size_based' && isset($pet)) {
            $petSizeId = $pet->size_category_id;
            
            if ($petSizeId) {
                $rule = $service->pricingRules()
                    ->where('basis_type', 'size')
                    ->where('reference_id', $petSizeId)
                    ->first();
                
                if ($rule) {
                    return (float) $rule->price * $quantity;
                }
            }

            // Fallback for legacy size_class
            if ($pet->size_class) {
                $priceRecord = $service->sizePrices()
                    ->where('size_class', $pet->size_class)
                    ->first();
                if ($priceRecord) {
                    return (float) $priceRecord->price * $quantity;
                }
            }
        }

        if ($service->pricing_type === 'weight_based' && isset($pet) && $pet->weight !== null) {
            $petWeight = (float) $pet->weight;
            
            $range = \App\Models\WeightRange::where('status', 'Active')
                ->where('min_weight', '<=', $petWeight)
                ->where(function ($query) use ($petWeight) {
                    $query->where('max_weight', '>=', $petWeight)
                          ->orWhereNull('max_weight');
                })
                ->first();

            if ($range) {
                $rule = $service->pricingRules()
                    ->where('basis_type', 'weight')
                    ->where('reference_id', $range->id)
                    ->first();
                
                if ($rule) {
                    return (float) $rule->price * $quantity;
                }
            }
        }

        // Final fallback: Use base_price or legacy price
        return ($service->base_price ?? $service->price ?? 0) * $quantity;
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

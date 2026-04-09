<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $settings = Setting::all()->pluck('value', 'key');
        return response()->json($settings->isEmpty() ? (object)[] : $settings);
    }

    /**
     * Update or create settings.
     */
    public function update(Request $request)
    {
        $validatedData = $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable',
        ]);

        foreach ($validatedData['settings'] as $key => $value) {
            $valueToStore = $value;

            // Basic phone normalization if key matches
            if ($key === 'phone_number' && !empty($value)) {
                $cleaned = preg_replace('/(?<!^)\+|[^0-9+]/', '', $value);
                if (str_starts_with($cleaned, '09') && strlen($cleaned) === 11) {
                    $valueToStore = '+63' . substr($cleaned, 1);
                } else {
                    $valueToStore = $cleaned;
                }
            }

            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $valueToStore]
            );
        }

        $allSettings = Setting::all()->pluck('value', 'key');
        return response()->json([
            'message' => 'Settings updated successfully',
            'settings' => $allSettings->isEmpty() ? (object)[] : $allSettings,
        ]);
    }
}

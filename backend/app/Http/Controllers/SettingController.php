<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;

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

        $phoneUtil = PhoneNumberUtil::getInstance();

        foreach ($validatedData['settings'] as $key => $value) {
            $valueToStore = $value;

            // Normalize phone number if key matches
            if ($key === 'phone_number' && !empty($value)) {
                try {
                    $phoneNumberProto = $phoneUtil->parse($value, "PH");
                    if ($phoneUtil->isValidNumber($phoneNumberProto)) {
                        $valueToStore = $phoneUtil->format($phoneNumberProto, PhoneNumberFormat::E164);
                    }
                } catch (\Exception $e) {
                    // Fallback to original value if parsing fails
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

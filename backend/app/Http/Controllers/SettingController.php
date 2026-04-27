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

            // Handle Clinic Logo Upload to Supabase/S3
            if ($key === 'clinic_logo' && !empty($value) && str_starts_with($value, 'data:image')) {
                try {
                    $parts = explode(',', $value);
                    if (count($parts) < 2) continue;

                    $image = str_replace(' ', '+', $parts[1]);
                    $imageName = 'logo_' . time() . '.png';
                    $fullPath = 'logos/' . $imageName;
                    
                    // Upload to Supabase
                    $success = \Illuminate\Support\Facades\Storage::disk('s3')->put($fullPath, base64_decode($image));
                    
                    if ($success) {
                        $valueToStore = $fullPath;
                    } else {
                        \Illuminate\Support\Facades\Log::error("Supabase put() returned false for: " . $fullPath);
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error("Logo Upload Exception: " . $e->getMessage());
                }
            }

            // Basic phone normalization... (existing logic)
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

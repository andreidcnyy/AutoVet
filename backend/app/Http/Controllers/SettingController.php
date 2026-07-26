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
            if ($key === 'clinic_logo' && is_string($value) && str_starts_with($value, 'data:image')) {
                \Illuminate\Support\Facades\Log::info("Logo upload START len=" . strlen($value));
                try {
                    if (!preg_match('/^data:image\/(\w+);base64,(.+)$/s', $value, $m)) {
                        throw new \RuntimeException('Invalid data URI');
                    }
                    $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
                    $binary = base64_decode(str_replace(' ', '+', $m[2]), true);
                    if ($binary === false || strlen($binary) === 0) {
                        throw new \RuntimeException('base64_decode failed (len=' . strlen($m[2]) . ')');
                    }

                    $fullPath = 'logos/logo_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
                    \App\Models\StoredFile::store($fullPath, $binary, 'image/' . $ext);
                    $valueToStore = '/media/' . $fullPath;
                    \Illuminate\Support\Facades\Log::info("Logo upload OK: " . $valueToStore);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error("Logo Upload FAILED: " . $e->getMessage());
                    return response()->json([
                        'message' => 'Logo upload failed: ' . $e->getMessage(),
                    ], 500);
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

<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Setup Wizard UI to prevent timeouts
Route::get('/setup-wizard', function () {
    return <<<'HTML'
    <!DOCTYPE html>
    <html>
    <head>
        <title>AutoVet Production Setup</title>
        <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f4f4f5; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            button { background: #0d9488; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; }
            button:disabled { background: #a1a1aa; cursor: not-allowed; }
            .log { margin-top: 20px; background: #18181b; color: #10b981; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; height: 200px; overflow-y: auto; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>AutoVet Database Sync</h2>
            <p>This process is split into smaller steps to prevent server timeouts.</p>
            <button id="startBtn" onclick="startSetup()">Start Sync Process</button>
            <div class="log" id="logBox">Waiting to start...</div>
        </div>

        <script>
            const steps = [
                { id: 'migrate', name: 'Optimizing Database Schema...' },
                { id: 'seed_core', name: 'Syncing Maintenance Labels & Categories...' },
                { id: 'seed_users', name: 'Checking System Administrators...' },
                { id: 'seed_ai', name: 'Calculating AI Service Models...' },
                { id: 'seed_bulk', name: 'Generating Precise Production Dataset (50 Clients, 101 Pets)...' },
                { id: 'align', name: 'Finalizing Clinic Alignment & Intelligence Sync...' }
            ];

            async function startSetup() {
                const btn = document.getElementById('startBtn');
                const log = document.getElementById('logBox');
                btn.disabled = true;
                log.innerHTML = '';

                for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];
                    log.innerHTML += `<div>> ${step.name}</div>`;
                    log.scrollTop = log.scrollHeight;
                    
                    try {
                        const res = await fetch(`/api/run-setup-step?step=${step.id}`);
                        const data = await res.json();
                        
                        if (!res.ok) throw new Error(data.error || 'Server error');
                        
                        log.innerHTML += `<div style="color: #34d399">> Success!</div>`;
                    } catch (err) {
                        log.innerHTML += `<div style="color: #f87171">> ERROR: ${err.message}</div>`;
                        btn.disabled = false;
                        return;
                    }
                }

                log.innerHTML += `<div style="color: #60a5fa; font-weight: bold; margin-top: 10px;">> ALL DONE! You can now log in to the Vercel dashboard.</div>`;
                log.scrollTop = log.scrollHeight;
            }
        </script>
    </body>
    </html>
    HTML;
});

Route::get('/status', function () {
    return response()->json(['status' => 'running', 'env' => app()->environment()]);
});

// One-shot fix: rewrite stale Supabase URLs that point at the old `autovet`
// bucket to the new `autovet-storage` bucket. Safe to call multiple times.
Route::get('/fix-logo-urls', function () {
    $a = \Illuminate\Support\Facades\DB::table('clinics')
        ->where('logo', 'like', '%/public/autovet/%')
        ->update(['logo' => \Illuminate\Support\Facades\DB::raw("REPLACE(logo, '/public/autovet/', '/public/autovet-storage/')")]);
    $b = \Illuminate\Support\Facades\DB::table('settings')
        ->where('key', 'clinic_logo')
        ->where('value', 'like', '%/public/autovet/%')
        ->update(['value' => \Illuminate\Support\Facades\DB::raw("REPLACE(value, '/public/autovet/', '/public/autovet-storage/')")]);
    return response()->json(['clinics_fixed' => $a, 'settings_fixed' => $b]);
});

/*
 * Public storage proxy.
 *
 * In dev (Laragon), the public/storage symlink serves files directly via the
 * web server, so this route is rarely hit. In production on Railway with
 * Cloudflare R2 (FILESYSTEM_PUBLIC=s3), the local symlink has nothing in it
 * and any /storage/... request lands here — we redirect to the actual R2
 * public URL so the frontend's existing <img src="/storage/..." /> just works
 * without any frontend changes.
 */
Route::get('/storage/{path}', function (string $path) {
    $disk = \Illuminate\Support\Facades\Storage::disk('public');
    $driver = config('filesystems.disks.public.driver');

    if ($driver === 's3') {
        return redirect()->away($disk->url($path));
    }

    if ($disk->exists($path)) {
        return $disk->response($path);
    }
    abort(404);
})->where('path', '.+');



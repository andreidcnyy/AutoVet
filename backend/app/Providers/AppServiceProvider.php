<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Services\Sms\SmsProviderInterface::class,
            \App\Services\Sms\LogSmsProvider::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Schema::defaultStringLength(191);

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(300)->by($request->user()?->id ?: $request->ip());
        });

        Mail::extend('brevo', function (array $config = []) {
            return (new BrevoTransportFactory())->create(
                new Dsn('brevo+api', 'default', $config['key'] ?? config('mail.mailers.brevo.key'))
            );
        });

        // Real-time: broadcast create/update/delete of these entities so open
        // admin pages refresh live. The frontend already listens for the generic
        // `.entity.created` event on the `admin.notifications` channel and refetches.
        // Guarded so it never runs during console (seeds/imports) or breaks a write.
        $realtimeModels = [
            \App\Models\Owner::class             => 'owner',
            \App\Models\Pet::class               => 'pet',
            \App\Models\MedicalRecord::class     => 'medical_record',
            \App\Models\Service::class           => 'service',
            \App\Models\VetSchedule::class       => 'vet_schedule',
            \App\Models\InventoryCategory::class => 'inventory_category',
            \App\Models\ServiceCategory::class   => 'service_category',
            \App\Models\Breed::class             => 'breed',
            \App\Models\Species::class           => 'species',
        ];
        foreach ($realtimeModels as $modelClass => $entityType) {
            $broadcast = function ($model) use ($entityType) {
                if (app()->runningInConsole()) return;
                try {
                    event(new \App\Events\EntityCreated($entityType, $model->getKey()));
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("Realtime broadcast failed for {$entityType}: " . $e->getMessage());
                }
            };
            $modelClass::created($broadcast);
            $modelClass::updated($broadcast);
            $modelClass::deleted($broadcast);
        }
    }
}

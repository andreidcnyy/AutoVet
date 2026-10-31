<?php

namespace App\Providers;

use App\Events\EntityCreated;
use App\Models\Breed;
use App\Models\InventoryCategory;
use App\Models\MedicalRecord;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Species;
use App\Models\VetSchedule;
use App\Services\Sms\LogSmsProvider;
use App\Services\Sms\SmsProviderInterface;
use App\Support\Tenant;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\ServiceProvider;
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
            SmsProviderInterface::class,
            LogSmsProvider::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        // `exists`, limited to the caller's clinic for clinic-owned tables.
        // Plain `exists` ignores the clinic scope, so staff could attach
        // records to another clinic's pets, owners or services by id. Rows
        // with no clinic (shared lookups) still count. Super admins and portal
        // clients are not clinic-bound here; see App\Support\Tenant.
        Validator::extend('clinic_exists', function ($attribute, $value, $parameters) {
            [$table, $column] = [$parameters[0], $parameters[1] ?? 'id'];

            $query = DB::table($table)->where($column, $value);

            if (($clinicId = Tenant::clinicId()) !== null) {
                $query->where(fn ($q) => $q->where("{$table}.clinic_id", $clinicId)->orWhereNull("{$table}.clinic_id"));
            }

            return $query->exists();
        }, 'The selected :attribute is invalid.');

        // Applied to every api route (bootstrap/app.php, throttleApi). It runs
        // before auth:sanctum, so the token user has to be looked up on the
        // sanctum guard: the default guard is web and never sees them, which
        // would put everyone on one shared IP limit. Staff and portal clients
        // live in different tables and can share an id, so the key carries
        // the model too.
        RateLimiter::for('api', function (Request $request) {
            $user = $request->user('sanctum');

            return Limit::perMinute(300)->by($user ? get_class($user).':'.$user->getKey() : $request->ip());
        });

        Mail::extend('brevo', function (array $config = []) {
            return (new BrevoTransportFactory)->create(
                new Dsn('brevo+api', 'default', $config['key'] ?? config('mail.mailers.brevo.key'))
            );
        });

        // Real-time: broadcast create/update/delete of these entities so open
        // admin pages refresh live. The frontend already listens for the generic
        // `.entity.created` event on the `admin.notifications` channel and refetches.
        // Guarded so it never runs during console (seeds/imports) or breaks a write.
        $realtimeModels = [
            Owner::class => 'owner',
            Pet::class => 'pet',
            MedicalRecord::class => 'medical_record',
            Service::class => 'service',
            VetSchedule::class => 'vet_schedule',
            InventoryCategory::class => 'inventory_category',
            ServiceCategory::class => 'service_category',
            Breed::class => 'breed',
            Species::class => 'species',
        ];
        foreach ($realtimeModels as $modelClass => $entityType) {
            $broadcast = function ($model) use ($entityType) {
                if (app()->runningInConsole()) {
                    return;
                }
                try {
                    event(new EntityCreated($entityType, $model->getKey()));
                } catch (\Throwable $e) {
                    Log::warning("Realtime broadcast failed for {$entityType}: ".$e->getMessage());
                }
            };
            $modelClass::created($broadcast);
            $modelClass::updated($broadcast);
            $modelClass::deleted($broadcast);
        }
    }
}

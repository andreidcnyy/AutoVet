<?php

namespace Tests\Feature;

use App\Enums\Roles;
use App\Models\Admin;
use App\Models\PortalUser;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Contracts\Routing\UrlRoutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as Router;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Calls every API route, as every kind of user, against a fully seeded clinic
 * and fails on any server error (5xx).
 *
 * Reads (GET) go out with real ids from the seeded data. Writes (POST, PUT,
 * PATCH) go out with an empty body: the right answer is a 4xx, and a 5xx
 * means the endpoint crashes on input it should have rejected. DELETE is left
 * out so the data the other calls need stays in place.
 */
#[Group('smoke')]
class EndpointSmokeTest extends TestCase
{
    use RefreshDatabase;

    /** The paid AI provider, and the socket handshake (needs a live broadcaster). */
    private const SKIP = [
        'api/broadcasting/auth',
        'api/ai/clinical-support',
    ];

    public function test_no_api_route_returns_a_server_error(): void
    {
        $this->seed(DatabaseSeeder::class);

        $clinicId = (int) DB::table('clinics')->where('status', 'active')->min('id');
        // The super admin goes last: its empty-bodied calls include actions
        // that need no input (such as toggling a clinic's status), which
        // would lock the clinic's own users out for the rest of the run.
        $users = [
            'clinic_admin' => Admin::factory()->role(Roles::CLINIC_ADMIN->value)->create(['clinic_id' => $clinicId]),
            'veterinarian' => Admin::factory()->role(Roles::VETERINARIAN->value)->create(['clinic_id' => $clinicId]),
            'staff' => Admin::factory()->role(Roles::STAFF->value)->create(['clinic_id' => $clinicId]),
            'client' => PortalUser::query()->where('clinic_id', $clinicId)->whereHas('owner')->first()
                ?? PortalUser::factory()->create(['clinic_id' => $clinicId]),
            'super_admin' => Admin::query()->where('role', Roles::SUPER_ADMIN->value)->first()
                ?? Admin::factory()->role(Roles::SUPER_ADMIN->value)->create(['clinic_id' => $clinicId]),
        ];

        $routes = collect(Router::getRoutes()->getRoutes())
            ->filter(fn (Route $r) => str_starts_with($r->uri(), 'api/') && ! in_array($r->uri(), self::SKIP, true))
            ->reject(fn (Route $r) => in_array('DELETE', $r->methods(), true));

        $failures = [];
        $tally = [];
        foreach ($users as $role => $user) {
            foreach ($routes as $route) {
                $method = $route->methods()[0];
                $uri = $this->fill($route);

                $this->app['auth']->forgetGuards();
                Sanctum::actingAs($user, ['*']);
                $response = $this->json($method, '/'.$uri);

                $tally[$role][$response->getStatusCode()] = ($tally[$role][$response->getStatusCode()] ?? 0) + 1;

                if ($response->getStatusCode() >= 500) {
                    $failures[] = sprintf('%-6s %-60s as %-12s -> %d %s', $method, $uri, $role, $response->getStatusCode(),
                        Str::limit((string) ($response->json('message') ?? $response->json('error') ?? ''), 120));
                }
            }
        }

        // SMOKE_REPORT=1 prints how many calls got each status, per role: a
        // run where every call is refused would also have no 5xx.
        if (getenv('SMOKE_REPORT')) {
            fwrite(STDERR, json_encode(['routes' => $routes->count(), 'statuses' => $tally])."\n");
        }

        $this->assertSame([], $failures, "Server errors:\n".implode("\n", $failures));
    }

    /** Swap each {parameter} for the key of a real row of the model it binds to, or 1. */
    private function fill(Route $route): string
    {
        $uri = $route->uri();
        $models = collect($route->signatureParameters(['subClass' => UrlRoutable::class]))
            ->mapWithKeys(fn ($p) => [$p->getName() => $p->getType()?->getName()]);

        return preg_replace_callback('/\{(\w+)\??\}/', function ($m) use ($models) {
            $class = $models[$m[1]] ?? null;
            if ($class && is_subclass_of($class, Model::class)) {
                $model = new $class;
                $key = $class::query()->withoutGlobalScopes()->value($model->getRouteKeyName());

                return $key ?? 1;
            }

            return 1;
        }, $uri);
    }
}

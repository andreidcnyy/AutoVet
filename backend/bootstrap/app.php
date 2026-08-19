<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->validateCsrfTokens(except: [
            'api/sync/receive',
            'api/login',
            'api/register',
        ]);

        // Ensure CORS is handled first, before any auth or route middleware
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);

        $middleware->api(prepend: [
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
        ]);

        $middleware->alias([
            'auth'        => \App\Http\Middleware\Authenticate::class,
            'role'        => \App\Http\Middleware\RoleMiddleware::class,
            'maintenance' => \App\Http\Middleware\CheckMaintenanceMode::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        });

        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($e instanceof AuthorizationException || $e instanceof AccessDeniedHttpException) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You do not have permission to access this resource.'
                ], 403);
            }

            // Let Laravel render the exceptions that already carry a correct
            // status and body. Without this the catch-all below turned every
            // validation failure into a 500 with no field errors, and every
            // missing record into a 500 instead of a 404.
            if (
                $e instanceof \Illuminate\Validation\ValidationException
                || $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                || $e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException
            ) {
                return null;
            }

            if ($request->is('api/*')) {
                // Raw exception messages carry SQL, table names and file paths.
                // Keep them in the logs; show clients something generic unless
                // debugging is explicitly switched on.
                if (!config('app.debug')) {
                    \Illuminate\Support\Facades\Log::error('[API 500] ' . $e->getMessage(), [
                        'exception' => get_class($e),
                        'file'      => $e->getFile() . ':' . $e->getLine(),
                        'url'       => $request->fullUrl(),
                    ]);
                }

                return response()->json([
                    'error'   => 'Server Error',
                    'message' => config('app.debug')
                        ? $e->getMessage()
                        : 'An unexpected error occurred. Please try again or contact support.',
                ], 500);
            }
        });

        // Report unhandled exceptions to Sentry when DSN is configured.
        if (app()->bound('sentry')) {
            $exceptions->reportable(function (\Throwable $e) {
                app('sentry')->captureException($e);
            });
        }
    })->create();

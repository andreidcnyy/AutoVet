<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Mail;

try {
    Mail::raw('AutoVet SMTP Test Message at ' . date('Y-m-d H:i:s'), function ($message) {
        $message->to('dreidacanayz@gmail.com')
                ->subject('AutoVet Connection Test');
    });
    echo "SUCCESS: Email sent through SMTP relay.\n";
} catch (\Exception $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
    echo "STACK: " . $e->getTraceAsString() . "\n";
}

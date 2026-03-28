<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$species = DB::table('species')->get();
foreach ($species as $s) {
    $count = DB::table('weight_ranges')->where('species_id', $s->id)->count();
    $labels = DB::table('weight_ranges')->where('species_id', $s->id)->pluck('label')->implode(', ');
    echo "ID: {$s->id}, Name: {$s->name}, Weight Ranges ($count): $labels\n";
}

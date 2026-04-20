<?php
require __DIR__ . '/backend/vendor/autoload.php';
$app = require_once __DIR__ . '/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Appointment;
use Carbon\Carbon;

$tz = 'Asia/Manila';
$today = Carbon::now($tz)->toDateString();
$tomorrow = Carbon::now($tz)->addDay()->toDateString();

echo "Timezone: $tz\n";
echo "Today PHP: $today\n";
echo "Tomorrow PHP: $tomorrow\n\n";

$activeStatuses = ['Approved', 'Pending', 'Scheduled', 'approved', 'pending', 'scheduled'];

$todayCount = Appointment::whereDate('date', $today)->count();
$todayActiveCount = Appointment::whereDate('date', $today)->whereIn('status', $activeStatuses)->count();

$tomorrowCount = Appointment::whereDate('date', $tomorrow)->count();
$tomorrowActiveCount = Appointment::whereDate('date', $tomorrow)->whereIn('status', $activeStatuses)->count();

echo "Appointments on $today (Total): $todayCount\n";
echo "Appointments on $today (Active): $todayActiveCount\n";
echo "Appointments on $tomorrow (Total): $tomorrowCount\n";
echo "Appointments on $tomorrow (Active): $tomorrowActiveCount\n";

echo "\nSample Statuses for $today:\n";
$statuses = Appointment::whereDate('date', $today)->pluck('status')->toArray();
print_r(array_count_values($statuses));

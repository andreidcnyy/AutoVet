<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class ServiceForecastAggregator
{
    public function getMonthlyData(): array
    {
        $user = auth()->user();
        $clinicId = $user ? ($user->clinic_id ?? null) : null;

        $query = DB::table('invoices as i')
            ->join('invoice_items as ii', 'ii.invoice_id', '=', 'i.id')
            ->join('services as s', 's.id', '=', 'ii.service_id');

        // If not a Super Admin (no clinic), filter by clinic. 
        // If Super Admin, show data from the first clinic or all.
        if ($clinicId) {
            $query->where('i.clinic_id', $clinicId);
        } else {
            // Fallback for Super Admin: show data from clinic 1
            $query->where('i.clinic_id', 1);
        }

        $results = $query->whereIn('i.status', ['Finalized', 'Paid', 'Partially Paid', 'Completed'])
            ->select(
                DB::raw("DATE_FORMAT(i.created_at, '%Y-%m') AS month"),
                DB::raw("SUM(CASE WHEN s.category = 'Consultation' THEN ii.qty ELSE 0 END) AS consultation"),
                DB::raw("SUM(CASE WHEN s.category = 'Grooming' THEN ii.qty ELSE 0 END) AS grooming"),
                DB::raw("SUM(CASE WHEN s.category = 'Vaccination' THEN ii.qty ELSE 0 END) AS vaccination"),
                DB::raw("SUM(CASE WHEN s.category = 'Laboratory' THEN ii.qty ELSE 0 END) AS laboratory"),
                DB::raw("SUM(CASE WHEN s.category NOT IN ('Consultation', 'Grooming', 'Vaccination', 'Laboratory') THEN ii.qty ELSE 0 END) AS others"),
                DB::raw("SUM(ii.qty) AS total_services"),
                DB::raw("COUNT(DISTINCT i.id) AS estimated_customers"),
                DB::raw("SUM(ii.amount) AS estimated_revenue")
            )
            ->groupBy('month')
            ->orderBy('month', 'ASC')
            ->get();

        // GAP FILLING LOGIC - Force 2023-01 through current month (no future months in history)
        $dataMap = $results->isEmpty() ? collect() : $results->keyBy('month');
        $start = Carbon::parse('2023-01-01');
        $end   = Carbon::now('Asia/Manila')->endOfMonth();
        
        $period = CarbonPeriod::create($start, '1 month', $end);
        $filled = [];

        foreach ($period as $dt) {
            $key = $dt->format('Y-m');
            if (isset($dataMap[$key])) {
                $row = $dataMap[$key];
                $filled[] = [
                    'month' => $key,
                    'consultation' => (int)$row->consultation,
                    'grooming' => (int)$row->grooming,
                    'vaccination' => (int)$row->vaccination,
                    'laboratory' => (int)$row->laboratory,
                    'others' => (int)$row->others,
                    'total_services' => (int)$row->total_services,
                    'estimated_customers' => (int)$row->estimated_customers,
                    'estimated_revenue' => (float)$row->estimated_revenue,
                ];
            } else {
                $filled[] = [
                    'month' => $key,
                    'consultation' => 0,
                    'grooming' => 0,
                    'vaccination' => 0,
                    'laboratory' => 0,
                    'others' => 0,
                    'total_services' => 0,
                    'estimated_customers' => 0,
                    'estimated_revenue' => 0.0,
                ];
            }
        }

        return $filled;
    }
}

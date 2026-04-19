<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ServiceForecastAggregator
{
    /**
     * Get monthly aggregated data for service forecasting.
     */
    public function getMonthlyData(): array
    {
        $query = DB::table('invoices as i')
            ->join('invoice_items as ii', 'ii.invoice_id', '=', 'i.id')
            ->join('services as s', 's.id', '=', 'ii.service_id')
            ->whereIn('i.status', ['Finalized', 'Paid', 'Partially Paid'])
            ->select(
                DB::raw("DATE_FORMAT(i.created_at, '%Y-%m') AS month"),
                DB::raw("SUM(CASE WHEN s.category = 'Consultation' THEN ii.qty ELSE 0 END) AS consultation"),
                DB::raw("SUM(CASE WHEN s.category = 'Consultation' THEN ii.amount ELSE 0 END) AS consultation_revenue"),
                DB::raw("SUM(CASE WHEN s.category = 'Grooming' THEN ii.qty ELSE 0 END) AS grooming"),
                DB::raw("SUM(CASE WHEN s.category = 'Grooming' THEN ii.amount ELSE 0 END) AS grooming_revenue"),
                DB::raw("SUM(CASE WHEN s.category = 'Vaccination' THEN ii.qty ELSE 0 END) AS vaccination"),
                DB::raw("SUM(CASE WHEN s.category = 'Vaccination' THEN ii.amount ELSE 0 END) AS vaccination_revenue"),
                DB::raw("SUM(CASE WHEN s.category = 'Laboratory' THEN ii.qty ELSE 0 END) AS laboratory"),
                DB::raw("SUM(CASE WHEN s.category = 'Laboratory' THEN ii.amount ELSE 0 END) AS laboratory_revenue"),
                DB::raw("SUM(CASE WHEN s.category NOT IN ('Consultation', 'Grooming', 'Vaccination', 'Laboratory') THEN ii.qty ELSE 0 END) AS others"),
                DB::raw("SUM(CASE WHEN s.category NOT IN ('Consultation', 'Grooming', 'Vaccination', 'Laboratory') THEN ii.amount ELSE 0 END) AS others_revenue"),
                DB::raw("SUM(ii.qty) AS total_services"),
                DB::raw("COUNT(DISTINCT i.id) AS estimated_customers"),
                DB::raw("SUM(ii.amount) AS estimated_revenue")
            )
            ->groupBy('month')
            ->orderBy('month', 'ASC')
            ->get();

        return $query->map(function ($row) {
            return [
                'month'                => $row->month,
                'consultation'         => (int) $row->consultation,
                'consultation_revenue' => (float) $row->consultation_revenue,
                'grooming'             => (int) $row->grooming,
                'grooming_revenue'     => (float) $row->grooming_revenue,
                'vaccination'          => (int) $row->vaccination,
                'vaccination_revenue'  => (float) $row->vaccination_revenue,
                'laboratory'           => (int) $row->laboratory,
                'laboratory_revenue'   => (float) $row->laboratory_revenue,
                'others'               => (int) $row->others,
                'others_revenue'       => (float) $row->others_revenue,
                'total_services'       => (int) $row->total_services,
                'estimated_customers'  => (int) $row->estimated_customers,
                'estimated_revenue'    => (float) $row->estimated_revenue,
            ];
        })->toArray();
    }
}

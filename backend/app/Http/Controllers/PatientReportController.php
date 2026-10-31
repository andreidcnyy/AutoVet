<?php

namespace App\Http\Controllers;

use App\Models\Owner;
use App\Models\Pet;
use App\Models\Species;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientReportController extends Controller
{
    /**
     * Get species distribution.
     */
    public function getSpeciesDistribution()
    {
        $distribution = Pet::select('species_id', DB::raw('count(*) as total'))
            ->with('species:id,name')
            ->groupBy('species_id')
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->species->name ?? 'Unknown',
                    'value' => $item->total,
                ];
            });

        return response()->json($distribution);
    }

    /**
     * Get owner registration trends.
     */
    public function getRegistrationTrends(Request $request)
    {
        $request->validate(['months' => 'nullable|integer|min:1|max:60']);
        $months = (int) $request->query('months', 6);
        $startDate = Carbon::now()->subMonths($months);

        $trends = Owner::where('created_at', '>=', $startDate)
            ->select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                DB::raw('COUNT(*) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json($trends);
    }

    /**
     * Get patient demographics (Sex, Size).
     */
    public function getDemographics()
    {
        $sexDistribution = Pet::select('sex', DB::raw('count(*) as total'))
            ->groupBy('sex')
            ->get();

        return response()->json([
            'sex' => $sexDistribution,
        ]);
    }
}

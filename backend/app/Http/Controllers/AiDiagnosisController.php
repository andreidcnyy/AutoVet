<?php

namespace App\Http\Controllers;

use App\Services\AiDiagnosisService;
use App\Models\Pet;
use App\Models\MedicalRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class AiDiagnosisController extends Controller
{
    public function __construct(private AiDiagnosisService $aiService) {}

    public function getSuggestions(Request $request): JsonResponse
    {
        // Feature flag gate
        if (!auth()->user()?->ai_features_enabled) {
            return response()->json(['error' => 'AI Clinical Support is not enabled for this account.'], 403);
        }

        $request->validate([
            'pet_id'   => 'required|integer|exists:pets,id',
            'symptoms' => 'required|string|min:5|max:1000',
        ]);

        $pet = Pet::with(['species', 'breed'])->findOrFail($request->pet_id);

        // Build medical history summary from last 5 records
        $history = MedicalRecord::where('pet_id', $pet->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn($r) => trim(implode(' | ', array_filter([
                $r->chief_complaint ? "CC: {$r->chief_complaint}" : null,
                $r->diagnosis       ? "Dx: {$r->diagnosis}"       : null,
                $r->treatment_plan  ? "Tx: {$r->treatment_plan}"  : null,
                $r->created_at      ? $r->created_at->format('M Y') : null,
            ]))))
            ->filter()
            ->values()
            ->toArray();

        $dob = $pet->date_of_birth
            ? Carbon::parse($pet->date_of_birth)->diffForHumans(null, true)
            : 'Unknown';

        $petProfile = [
            'name'            => $pet->name,
            'species'         => $pet->species?->name ?? 'Unknown',
            'breed'           => $pet->breed?->name   ?? 'Unknown',
            'age'             => $dob,
            'weight'          => $pet->weight ? "{$pet->weight} {$pet->weight_unit}" : 'Unknown',
            'sex'             => $pet->sex    ?? 'Unknown',
            'allergies'       => $pet->allergies ?? 'None on file',
            'medical_history' => $history,
        ];

        $result = $this->aiService->getSupportSuggestions($petProfile, $request->symptoms);

        if (isset($result['error'])) {
            return response()->json($result, 500);
        }

        return response()->json($result);
    }
}

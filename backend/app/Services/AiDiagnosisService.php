<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiDiagnosisService
{
    private string $apiKey;
    private string $model = 'claude-sonnet-4-6';
    private string $apiUrl = 'https://api.anthropic.com/v1/messages';

    public function __construct()
    {
        $this->apiKey = config('services.anthropic.key', '');
    }

    public function getSupportSuggestions(array $petProfile, string $symptoms): array
    {
        if (!$this->apiKey) {
            return ['error' => 'AI service is not configured.'];
        }

        $prompt = $this->buildPrompt($petProfile, $symptoms);

        try {
            $response = Http::withHeaders([
                'x-api-key'         => $this->apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type'      => 'application/json',
            ])->post($this->apiUrl, [
                'model'      => $this->model,
                'max_tokens' => 1024,
                'messages'   => [
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

            if (!$response->successful()) {
                Log::error('[AI-DIAGNOSIS] API error: ' . $response->body());
                return ['error' => 'AI service returned an error. Please try again.'];
            }

            $content = $response->json('content.0.text', '');
            return $this->parseResponse($content);

        } catch (\Throwable $e) {
            Log::error('[AI-DIAGNOSIS] Exception: ' . $e->getMessage());
            return ['error' => 'AI service is temporarily unavailable.'];
        }
    }

    private function buildPrompt(array $pet, string $symptoms): string
    {
        $history = !empty($pet['medical_history'])
            ? implode("\n", array_map(fn($r) => "- {$r}", $pet['medical_history']))
            : 'No prior records on file.';

        return <<<PROMPT
You are a veterinary clinical support assistant. Your role is to support — not replace — the attending veterinarian by surfacing relevant differential considerations based on reported symptoms and patient history.

IMPORTANT RULES:
- Never provide a definitive diagnosis
- Always end with a recommendation to consult the attending veterinarian
- Use clear, non-alarming language suitable for a clinic admin reading a pre-visit summary
- Limit differentials to 3-5 most relevant conditions
- For each differential, briefly state why it is relevant given the symptom profile
- Flag if any symptoms suggest urgency requiring same-day attention

PATIENT PROFILE:
- Name: {$pet['name']}
- Species: {$pet['species']}
- Breed: {$pet['breed']}
- Age: {$pet['age']}
- Weight: {$pet['weight']}
- Sex: {$pet['sex']}
- Known Allergies: {$pet['allergies']}

REPORTED SYMPTOMS:
{$symptoms}

MEDICAL HISTORY:
{$history}

Respond in this exact JSON format:
{
  "urgency": "routine|same-day|emergency",
  "urgency_reason": "one sentence explaining urgency level",
  "differentials": [
    {
      "condition": "Condition Name",
      "relevance": "Why this fits the symptom profile",
      "recommended_diagnostics": "What tests would help confirm or rule out"
    }
  ],
  "pre_visit_notes": "What the owner should observe or prepare before the visit",
  "disclaimer": "This is an AI-generated clinical support summary. Final assessment and diagnosis are the sole responsibility of the attending veterinarian."
}
PROMPT;
    }

    private function parseResponse(string $raw): array
    {
        // Extract JSON from the response
        preg_match('/\{[\s\S]*\}/m', $raw, $matches);
        if (empty($matches)) {
            return ['error' => 'Could not parse AI response.', 'raw' => $raw];
        }

        $parsed = json_decode($matches[0], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['error' => 'Invalid JSON from AI.', 'raw' => $raw];
        }

        return $parsed;
    }
}

<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RegistrationAbuseTest extends TestCase
{
    use RefreshDatabase;

    private function register(array $data, string $ip = '203.0.113.10')
    {
        return $this->withHeader('X-Forwarded-For', $ip.', 76.76.21.21')
            ->postJson('/api/register', $data);
    }

    public function test_one_address_cannot_be_sent_more_than_five_sign_ups_an_hour(): void
    {
        // Spread across visitors, so only the per-address limit applies.
        foreach (range(1, 5) as $i) {
            $this->register(['email' => 'victim@example.com'], "203.0.113.$i")->assertStatus(422);
        }

        $this->register(['email' => 'victim@example.com'], '203.0.113.99')->assertStatus(429);
    }

    public function test_one_visitor_hitting_the_limit_does_not_lock_out_others(): void
    {
        foreach (range(1, 5) as $i) {
            $this->register(['email' => "spam$i@example.com"])->assertStatus(422);
        }
        $this->register(['email' => 'spam6@example.com'])->assertStatus(429);

        // Same proxy in front, different visitor behind it.
        $this->register(['email' => 'someone@example.com'], '198.51.100.7')->assertStatus(422);
    }

    public function test_turnstile_is_required_once_a_secret_is_configured(): void
    {
        config(['services.turnstile.secret_key' => 'test-secret']);
        Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => false])]);

        $this->register([
            'name' => 'Bot',
            'email' => 'bot@gmail.com',
            'phone' => '09123456789',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'turnstile_token' => 'forged',
        ])->assertStatus(422)->assertJsonValidationErrors('turnstile_token');
    }
}

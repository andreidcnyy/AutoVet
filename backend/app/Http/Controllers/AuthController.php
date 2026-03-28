<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);


        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['error' => 'User not found', 'email' => $request->email], 401);
        }

        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'error' => 'Password mismatch',
                'input_password' => $request->password,
                'db_hash' => $user->password,
            ], 401);
        }

        // Generate Sanctum API token
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'avatar' => $user->avatar,
            'status' => $user->status,
            'token' => $token,
        ]);
    }
}

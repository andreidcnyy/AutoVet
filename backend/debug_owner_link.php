<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Owner;

// Find an owner with a linked portal user
$owner = Owner::whereNotNull('user_id')->with('user')->first();

if ($owner) {
    echo "--- Found Owner with Portal User ---
";
    echo "Owner ID: " . $owner->id . "
";
    echo "Owner Name: " . $owner->name . "
";
    echo "User ID: " . $owner->user_id . "
";
    
    // Check if the user relationship is loaded
    if ($owner->relationLoaded('user') && $owner->user) {
        echo "Portal User Email: " . $owner->user->email . "
";
        echo "SUCCESS: The 'user' relationship is loaded correctly on the Owner model.
";
    } else {
        echo "FAILURE: The 'user' relationship was NOT loaded on the Owner model.
";
    }
    
    echo "
--- Testing Controller Response ---
";
    
    // Simulate a request to the controller's show method
    $controller = app(App\Http\Controllers\OwnerController::class);
    $response = $controller->show($owner);
    $data = json_decode($response->getContent(), true);

    if (isset($data['user']) && !empty($data['user'])) {
        echo "SUCCESS: OwnerController@show correctly includes the 'user' object in the JSON response.
";
        echo "User object in response: 
";
        print_r($data['user']);
    } else {
        echo "FAILURE: OwnerController@show did NOT include the 'user' object in the JSON response.
";
    }
    
} else {
    echo "No owner with a linked portal user found in the database. Please ensure seeding is correct or an account has been registered via the portal.
";
}

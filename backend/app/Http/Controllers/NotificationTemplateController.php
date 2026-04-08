<?php

namespace App\Http\Controllers;

use App\Models\NotificationTemplate;
use Illuminate\Http\Request;

class NotificationTemplateController extends Controller
{
    public function index()
    {
        return response()->json(NotificationTemplate::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'channel' => 'required|in:email,sms',
            'event_key' => 'nullable|string|max:100',
            'subject' => 'nullable|string|max:255',
            'body' => 'required|string',
            'is_active' => 'boolean'
        ]);

        $template = NotificationTemplate::create($validated);
        return response()->json($template, 201);
    }

    public function update(Request $request, NotificationTemplate $template)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'channel' => 'required|in:email,sms',
            'event_key' => 'nullable|string|max:100',
            'subject' => 'nullable|string|max:255',
            'body' => 'required|string',
            'is_active' => 'boolean'
        ]);

        $template->update($validated);
        return response()->json($template);
    }

    public function destroy(NotificationTemplate $template)
    {
        $template->delete();
        return response()->json(['message' => 'Template deleted']);
    }
}

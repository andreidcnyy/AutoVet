<?php

namespace App\Http\Controllers;

use App\Models\ClientNotification;
use App\Models\Owner;
use App\Models\NotificationTemplate;
use App\Services\ClientNotificationService;
use Illuminate\Http\Request;

class ClientNotificationController extends Controller
{
    protected ClientNotificationService $service;

    public function __construct(ClientNotificationService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $query = ClientNotification::with('owner')->latest();

        if ($request->has('owner_id')) {
            $query->where('owner_id', $request->owner_id);
        }

        if ($request->has('channel')) {
            $query->where('channel', $request->channel);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate(20));
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'owner_id' => 'required|exists:owners,id',
            'channel' => 'required|in:email,sms',
            'template_id' => 'nullable|exists:notification_templates,id',
            'custom_message' => 'nullable|string',
            'title' => 'nullable|string', // primarily for email
            'related_type' => 'nullable|string',
            'related_id' => 'nullable|integer',
        ]);

        $owner = Owner::findOrFail($validated['owner_id']);

        $relatedModel = null;
        if (!empty($validated['related_type']) && !empty($validated['related_id'])) {
            try {
                $relatedModel = $validated['related_type']::findOrFail($validated['related_id']);
            } catch (\Exception $e) {
                // Ignore if model not found
            }
        }

        $message = '';
        $title = $validated['title'] ?? 'Notification from AutoVet';

        if (!empty($validated['template_id'])) {
            $template = NotificationTemplate::findOrFail($validated['template_id']);
            $message = $this->service->interpolateVariables($template->body, [], $owner, $relatedModel);
            if ($template->subject && $validated['channel'] === 'email') {
                $title = $this->service->interpolateVariables($template->subject, [], $owner, $relatedModel);
            }
        } else if (!empty($validated['custom_message'])) {
            $message = $this->service->interpolateVariables($validated['custom_message'], [], $owner, $relatedModel);
        } else {
            return response()->json(['message' => 'Must provide either custom_message or template_id'], 422);
        }

        try {
            $notification = $this->service->send($owner, $validated['channel'], $message, $title, 'manual', $relatedModel);
            return response()->json($notification);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to send notification: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 422);
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Review;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    // Public — landing page
    public function publicIndex()
    {
        $reviews = Review::where('is_approved', true)
            ->orderByDesc('is_featured')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($reviews);
    }

    // Portal — return all invoices awaiting review (last 30 days)
    public function pending(Request $request)
    {
        $user = $request->user();
        if (!$user || !method_exists($user, 'isOwner') || !$user->isOwner()) {
            return response()->json(['invoices' => []]);
        }

        $invoices = Invoice::whereHas('pet.owner', fn ($q) => $q->where('user_id', $user->id))
            ->whereIn('status', ['Finalized', 'Paid'])
            ->where('created_at', '>=', now()->subDays(30))
            ->whereDoesntHave('review')
            ->with('pet.species')
            ->latest()
            ->get();

        return response()->json(['invoices' => $invoices]);
    }

    // Portal — submit a review
    public function store(Request $request)
    {
        $validated = $request->validate([
            'invoice_id' => 'required|exists:invoices,id',
            'rating'     => 'required|integer|min:1|max:5',
            'title'      => 'nullable|string|max:100',
            'body'       => 'required|string|min:10|max:1000',
        ]);

        $user = $request->user();
        if (!$user || !method_exists($user, 'isOwner') || !$user->isOwner()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $invoice = Invoice::whereHas('pet.owner', fn ($q) => $q->where('user_id', $user->id))
            ->with('pet.species')
            ->findOrFail($validated['invoice_id']);

        if (Review::where('invoice_id', $invoice->id)->exists()) {
            return response()->json(['message' => 'You have already reviewed this invoice.'], 422);
        }

        $review = Review::create([
            'clinic_id'      => $user->clinic_id,
            'portal_user_id' => $user->id,
            'invoice_id'     => $invoice->id,
            'rating'         => $validated['rating'],
            'title'          => $validated['title'] ?? null,
            'body'           => $validated['body'],
            'reviewer_name'  => $user->name,
            'pet_name'       => $invoice->pet->name ?? null,
            'pet_species'    => $invoice->pet->species->name ?? null,
            'is_approved'    => false,
            'is_featured'    => false,
        ]);

        return response()->json(['message' => 'Thank you for your feedback!', 'review' => $review], 201);
    }

    // Admin — list all reviews
    public function index()
    {
        $reviews = Review::orderByDesc('created_at')->get();
        return response()->json($reviews);
    }

    // Admin — toggle approved (shown on landing page)
    public function approve(Review $review)
    {
        $review->update(['is_approved' => !$review->is_approved]);
        if (!$review->is_approved) {
            $review->update(['is_featured' => false]);
        }
        return response()->json(['message' => 'Review updated.', 'review' => $review->fresh()]);
    }

    // Admin — toggle featured
    public function feature(Review $review)
    {
        if (!$review->is_approved) {
            return response()->json(['message' => 'Review must be approved before featuring.'], 422);
        }
        $review->update(['is_featured' => !$review->is_featured]);
        return response()->json(['message' => 'Review updated.', 'review' => $review->fresh()]);
    }

    // Admin — delete
    public function destroy(Review $review)
    {
        $review->delete();
        return response()->json(['message' => 'Review deleted.']);
    }
}

function PlaceholderCard({ pageLabel }) {
  return (
    <section className="card-shell p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-zinc-900">{pageLabel}</h2>
      <p className="mt-2 text-sm text-zinc-500">Step 1 scaffold ready.</p>
    </section>
  );
}

export default PlaceholderCard;

const cards = ["Live system metrics", "Bus execution metrics", "Warm pool visualisation", "Worker monitoring", "Queue monitoring"];

export function ObservabilityPage() {
  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Observability</h1>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article key={card} className="min-h-40 rounded border border-border-subtle bg-bg-surface p-4">
            <p className="text-sm text-text-secondary">{card}</p>
            <div className="mt-6 h-16 rounded bg-bg-muted" />
          </article>
        ))}
      </section>
    </main>
  );
}

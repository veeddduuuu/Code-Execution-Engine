import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl place-items-center px-4">
      <section className="rounded border border-border-subtle bg-bg-surface p-6">
        <p className="text-sm text-text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Route not found</h1>
        <Link className="mt-4 inline-block rounded bg-bg-inverse px-4 py-2 text-text-inverse" to="/workspace">
          Workspace
        </Link>
      </section>
    </main>
  );
}

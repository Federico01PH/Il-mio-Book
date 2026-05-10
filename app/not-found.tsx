import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-text">
      <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-black/70 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.32em] text-muted">404</p>
        <h1 className="text-2xl font-semibold text-white">Pagina non trovata</h1>
        <Link
          href="/"
          className="inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white transition hover:bg-white/15"
        >
          Torna alla home
        </Link>
      </div>
    </div>
  );
}

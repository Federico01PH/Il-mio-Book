'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-text">
      <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-black/70 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.32em] text-muted">Errore</p>
        <h1 className="text-2xl font-semibold text-white">Qualcosa è andato storto</h1>
        <p className="text-sm text-muted">{error.message || 'Riprova fra qualche istante.'}</p>
        <button
          onClick={reset}
          className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.24em] text-white transition hover:bg-white/15"
        >
          Riprova
        </button>
      </div>
    </div>
  );
}

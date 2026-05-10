export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-muted">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.32em]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
        Caricamento
      </div>
    </div>
  );
}

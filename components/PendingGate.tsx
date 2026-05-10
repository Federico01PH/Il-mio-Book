'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function PendingGate({ rejected = false }: { rejected?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (rejected) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [rejected, router]);

  async function reset() {
    await fetch('/api/abandon-request', { method: 'POST' });
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-black/80 p-10 text-center shadow-2xl shadow-black/30"
      >
        <p className="text-xs uppercase tracking-[0.4em] text-muted">
          {rejected ? 'Richiesta rifiutata' : 'Richiesta in attesa'}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {rejected ? 'Accesso non autorizzato' : 'Stiamo controllando la tua richiesta'}
        </h1>
        <p className="text-sm leading-7 text-muted">
          {rejected
            ? 'La tua richiesta non è stata approvata. Puoi inviarne una nuova quando vuoi.'
            : 'Lascia questa pagina aperta: appena verrà approvata, entrerai automaticamente. Puoi anche tornare più tardi.'}
        </p>

        {!rejected ? (
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.28em] text-white/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
            Aggiornamento automatico ogni 10 secondi
          </div>
        ) : null}

        <button
          onClick={reset}
          className="text-xs uppercase tracking-[0.24em] text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          {rejected ? 'Invia una nuova richiesta' : 'Annulla la richiesta'}
        </button>
      </motion.div>
    </div>
  );
}

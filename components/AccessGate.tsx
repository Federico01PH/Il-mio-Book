'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function AccessGate() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.message ?? 'Errore durante l’invio.');
        return;
      }

      toast.success('Richiesta inviata.');
      setEmail('');
      setReason('');
      setDone(true);
    } catch (err) {
      console.error('Request access error:', err);
      toast.error('Impossibile inviare la richiesta. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-black/80 p-10 shadow-2xl shadow-black/30"
      >
        <div className="mb-8 space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Accesso riservato</p>
          <h1 className="text-3xl font-semibold">Richiedi accesso al book</h1>
          <p className="text-sm leading-6 text-muted">
            Inserisci la tua email e la motivazione. Riceverai un link di accesso una volta approvato.
          </p>
        </div>

        {done ? (
          <div className="space-y-3 text-center text-sm text-muted">
            <p>Richiesta ricevuta. Controlla la tua email nei prossimi giorni.</p>
            <button
              onClick={() => setDone(false)}
              className="text-xs uppercase tracking-[0.28em] text-white hover:underline"
            >
              Invia un’altra richiesta
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <label className="block text-sm text-muted">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-text outline-none transition focus:border-white/40"
              />
            </label>

            <label className="block text-sm text-muted">
              Motivazione
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={10}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-text outline-none transition focus:border-white/40"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Invio…' : 'Richiedi accesso'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

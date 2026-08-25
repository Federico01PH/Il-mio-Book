'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const MIN = 12;

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < MIN) {
      toast.error(`La password deve avere almeno ${MIN} caratteri.`);
      return;
    }
    if (password !== confirm) {
      toast.error('Le due password non coincidono.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.message ?? 'Reset fallito.');
        return;
      }
      setDone(true);
      toast.success('Password aggiornata. Ora puoi accedere.');
      setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
    } catch {
      toast.error('Errore di rete.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-black/80 p-10 text-center">
        <h1 className="text-2xl font-semibold text-white">Link non valido</h1>
        <p className="text-sm text-muted">
          Manca il codice di reset. Richiedi un nuovo link dalla pagina di accesso.
        </p>
        <a href="/admin/login" className="inline-block text-xs uppercase tracking-[0.24em] text-white/70 hover:text-white">
          ← Torna al login
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-emerald-400/30 bg-black/80 p-10 text-center">
        <h1 className="text-2xl font-semibold text-white">Fatto ✓</h1>
        <p className="text-sm text-muted">Password aggiornata. Ti porto al login…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-6 rounded-3xl border border-white/10 bg-black/80 p-10">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.32em] text-muted">Area amministrativa</p>
        <h1 className="text-2xl font-semibold text-white">Nuova password</h1>
        <p className="text-xs text-muted">Almeno {MIN} caratteri.</p>
      </div>
      <label className="block text-sm text-muted">
        Nuova password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-text outline-none focus:border-white/40"
        />
      </label>
      <label className="block text-sm text-muted">
        Ripeti la password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-text outline-none focus:border-white/40"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:opacity-60"
      >
        {loading ? 'Salvataggio…' : 'Imposta password'}
      </button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function forgot() {
    setForgotLoading(true);
    try {
      await fetch('/api/admin/forgot', { method: 'POST' });
      toast.success('Se l’indirizzo admin è valido, ti abbiamo inviato un’email con il link per reimpostare la password. Controlla anche lo spam.', {
        duration: 8000
      });
    } catch {
      toast.error('Errore di rete. Riprova.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? 'Login fallito.');
        return;
      }
      window.location.href = next.startsWith('/') ? next : '/admin';
    } catch (err) {
      console.error(err);
      toast.error('Errore di rete.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm space-y-6 rounded-3xl border border-white/10 bg-black/80 p-10"
    >
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.32em] text-muted">Area amministrativa</p>
        <h1 className="text-2xl font-semibold">Accesso admin</h1>
      </div>
      <label className="block text-sm text-muted">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-text outline-none focus:border-white/40"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:opacity-60"
      >
        {loading ? 'Accesso…' : 'Entra'}
      </button>
      <button
        type="button"
        onClick={forgot}
        disabled={forgotLoading}
        className="block w-full text-center text-xs uppercase tracking-[0.2em] text-muted hover:text-white transition disabled:opacity-60"
      >
        {forgotLoading ? 'Invio…' : 'Password dimenticata?'}
      </button>
    </form>
  );
}

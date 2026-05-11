'use client';

import { useState } from 'react';

export default function StorageChecker() {
  const [checkResult, setCheckResult] = useState<Record<string, unknown> | null>(null);
  const [testResult, setTestResult]   = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]         = useState(false);
  const [testing, setTesting]         = useState(false);

  async function check() {
    setLoading(true);
    setCheckResult(null);
    try {
      const res  = await fetch('/api/admin/check-storage');
      setCheckResult(await res.json());
    } catch {
      setCheckResult({ errore: 'Richiesta fallita — controlla la connessione.' });
    } finally {
      setLoading(false);
    }
  }

  async function testUpload() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/check-storage', { method: 'POST' });
      setTestResult(await res.json());
    } catch {
      setTestResult({ errore: 'Richiesta fallita.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.24em] text-muted">Diagnostica storage</span>

        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? 'Controllo…' : 'Controlla stato'}
        </button>

        <button
          type="button"
          onClick={testUpload}
          disabled={testing}
          className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
        >
          {testing ? 'Test…' : 'Test upload pixel'}
        </button>
      </div>

      {checkResult && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted">Stato connessione</p>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-3 text-[11px] leading-5 text-white/80">
            {JSON.stringify(checkResult, null, 2)}
          </pre>
        </div>
      )}

      {testResult && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted">Risultato test upload</p>
          <pre className={`overflow-x-auto rounded-xl border p-3 text-[11px] leading-5 ${
            String(testResult.upload).startsWith('OK')
              ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200'
              : 'border-rose-400/30 bg-rose-400/5 text-rose-200'
          }`}>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FileItem {
  id: string;
  file: File;
  preview: string;
  caption: string;
  progress: number;      // 0-100
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
}

/** Comprime l'immagine a max 1200 px lato lungo, JPEG 80% via Canvas. */
function compressToJpeg(file: File, maxPx = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round(img.naturalWidth  * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas non disponibile'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compressione fallita')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossibile leggere il file')); };
    img.src = url;
  });
}

/** Upload via XHR con tracking progresso; risolve {ok, error}. */
function xhrPut(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () => resolve({ ok: xhr.status < 300, status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => resolve({ ok: false, status: 0, text: 'Errore di rete' });
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(body);
  });
}

export default function PhotoUploader({
  folderId,
  folderSlug
}: {
  folderId: string;
  folderSlug: string;
}) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems]       = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary]   = useState('');

  function updateItem(id: string, patch: Partial<FileItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newItems: FileItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      preview: URL.createObjectURL(f),
      caption: '',
      progress: 0,
      status: 'idle'
    }));
    setItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function uploadOne(item: FileItem): Promise<'done' | 'error'> {
    const fail = (msg: string) => {
      updateItem(item.id, { status: 'error', error: msg, progress: 0 });
      return 'error' as const;
    };

    updateItem(item.id, { status: 'uploading', progress: 3 });

    // ── 1. Comprimi preview (Canvas, max 1200 px, JPEG 80%) ──────────────
    let previewBlob: Blob;
    try {
      previewBlob = await compressToJpeg(item.file);
    } catch (e) {
      return fail(`Compressione fallita: ${e instanceof Error ? e.message : String(e)}`);
    }
    updateItem(item.id, { progress: 10 });

    // ── 2. Ottieni URL firmati da Supabase (piccola richiesta JSON) ───────
    let previewSignedUrl: string, hiResSignedUrl: string;
    let previewPath: string, hiResPath: string;
    try {
      const res = await fetch('/api/admin/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, filename: item.file.name })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return fail(body.message ?? `sign-upload errore ${res.status}`);
      }
      ({ previewSignedUrl, previewPath, hiResSignedUrl, hiResPath } = await res.json());
    } catch {
      return fail('Errore di rete (sign-upload)');
    }
    updateItem(item.id, { progress: 15 });

    // ── 3. Upload preview compressa → Supabase photos bucket (0-65%) ─────
    const previewResult = await xhrPut(
      previewSignedUrl,
      previewBlob,
      'image/jpeg',
      (pct) => updateItem(item.id, { progress: 15 + Math.round(pct * 0.5) })
    );
    if (!previewResult.ok) {
      return fail(`Upload preview fallito (${previewResult.status})`);
    }
    updateItem(item.id, { progress: 65 });

    // ── 4. Upload originale → Supabase hi-res bucket (65-90%) ────────────
    const hiResResult = await xhrPut(
      hiResSignedUrl,
      item.file,
      item.file.type || 'image/jpeg',
      (pct) => updateItem(item.id, { progress: 65 + Math.round(pct * 0.25) })
    );
    if (!hiResResult.ok) {
      // Non bloccante: procediamo comunque
      console.warn('[PhotoUploader] hi-res upload fallito:', hiResResult.status);
      hiResPath = '';
    }
    updateItem(item.id, { progress: 90 });

    // ── 5. Registra nel DB ────────────────────────────────────────────────
    try {
      const res = await fetch('/api/admin/finalize-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId,
          previewPath,
          hiResPath: hiResPath || null,
          caption: item.caption || null
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return fail(body.message ?? `DB error ${res.status}`);
      }
    } catch {
      return fail('Errore di rete (finalize)');
    }

    updateItem(item.id, { status: 'done', progress: 100 });
    return 'done';
  }

  async function uploadAll() {
    const toUpload = items.filter((it) => it.status === 'idle');
    if (!toUpload.length || uploading) return;
    setUploading(true);
    setSummary('');

    let done = 0, errors = 0;
    for (const it of toUpload) {
      const r = await uploadOne(it);
      r === 'done' ? done++ : errors++;
    }

    setUploading(false);
    if (errors === 0) {
      setSummary(`✓ ${done} ${done === 1 ? 'foto caricata' : 'foto caricate'}`);
      setTimeout(() => {
        items.forEach((it) => URL.revokeObjectURL(it.preview));
        setItems([]);
        setSummary('');
        router.refresh();
      }, 1500);
    } else {
      setSummary(`${done} ok · ${errors} errori`);
    }
  }

  const idle = items.filter((i) => i.status === 'idle').length;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/15 disabled:opacity-50"
        >
          + Seleziona foto
        </button>

        {idle > 0 && !uploading && (
          <button
            type="button"
            onClick={uploadAll}
            className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90"
          >
            Carica {idle} {idle === 1 ? 'foto' : 'foto'}
          </button>
        )}

        {uploading && (
          <span className="animate-pulse text-xs uppercase tracking-[0.24em] text-white/70">
            Caricamento in corso…
          </span>
        )}
        {!uploading && summary && (
          <span className={`text-xs uppercase tracking-[0.24em] ${summary.startsWith('✓') ? 'text-emerald-300' : 'text-rose-300'}`}>
            {summary}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={onFilesSelected}
      />

      {/* Griglia preview */}
      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.id}
              className={`relative rounded-xl border p-3 ${
                it.status === 'done'
                  ? 'border-emerald-400/40 bg-emerald-400/5'
                  : it.status === 'error'
                  ? 'border-rose-400/40 bg-rose-400/5'
                  : 'border-white/10 bg-black/40'
              }`}
            >
              {/* Preview */}
              <div className="relative mb-2 h-32 w-full overflow-hidden rounded-lg bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.preview} alt="" className="h-full w-full object-cover" />
                {it.status === 'uploading' && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                )}
                {it.status === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xl">✓</div>
                )}
              </div>

              {/* Caption */}
              <input
                value={it.caption}
                onChange={(e) => updateItem(it.id, { caption: e.target.value })}
                placeholder="Didascalia (opzionale)"
                disabled={uploading || it.status !== 'idle'}
                className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-white/30 disabled:opacity-40"
              />

              {it.error && <p className="mt-1 text-xs text-rose-300">{it.error}</p>}

              {it.status === 'idle' && !uploading && (
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white/60 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

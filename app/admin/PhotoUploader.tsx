'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FileItem {
  file: File;
  preview: string;
  caption: string;
  hiResFile: File | null;
  status: 'idle' | 'uploading' | 'done' | 'error';
  error?: string;
}

export default function PhotoUploader({
  folderId,
  folderSlug
}: {
  folderId: string;
  folderSlug: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newItems: FileItem[] = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      caption: f.name.replace(/\.[^.]+$/, ''),
      hiResFile: null,
      status: 'idle'
    }));
    setItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  }

  function removeItem(idx: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function setCaption(idx: number, caption: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, caption } : it)));
  }

  function setHiRes(idx: number, file: File | null) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, hiResFile: file } : it)));
  }

  function setStatus(idx: number, status: FileItem['status'], error?: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status, error } : it)));
  }

  async function uploadAll() {
    if (items.length === 0 || uploading) return;
    setUploading(true);

    try {
      // 1. Chiedi URL firmati per ogni file (e hi-res opzionali)
      const filesMeta = items.flatMap((it) => {
        const list: { name: string; type: string; isHiRes: boolean }[] = [
          { name: it.file.name, type: it.file.type, isHiRes: false }
        ];
        if (it.hiResFile) {
          list.push({ name: it.hiResFile.name, type: it.hiResFile.type, isHiRes: true });
        }
        return list;
      });

      const urlRes = await fetch('/api/admin/upload-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, files: filesMeta })
      });

      if (!urlRes.ok) {
        const b = await urlRes.json().catch(() => ({}));
        throw new Error(b.message ?? 'Errore nella generazione degli URL');
      }

      const { uploads } = await urlRes.json() as {
        uploads: { signedUrl: string; token: string; path: string; originalName: string; isHiRes: boolean }[];
      };

      // Mappa nome file → upload info
      const normalUploads = uploads.filter((u) => !u.isHiRes);
      const hiResUploads = uploads.filter((u) => u.isHiRes);

      let done = 0;
      const total = items.length;

      // 2. Carica in parallelo tutti i file principali
      const mainResults = await Promise.all(
        items.map(async (it, idx) => {
          const uploadInfo = normalUploads[idx];
          if (!uploadInfo) throw new Error('Upload info mancante');

          setStatus(idx, 'uploading');

          const { error } = await supabase.storage
            .from('photos')
            .uploadToSignedUrl(uploadInfo.path, uploadInfo.token, it.file, {
              contentType: it.file.type,
              upsert: false
            });

          if (error) {
            setStatus(idx, 'error', error.message);
            throw new Error(error.message);
          }

          // Hi-res opzionale
          let hiResPath: string | undefined;
          if (it.hiResFile) {
            const hiInfo = hiResUploads.find((h) => h.originalName === it.hiResFile!.name);
            if (hiInfo) {
              const { error: hiErr } = await supabase.storage
                .from('hi-res')
                .uploadToSignedUrl(hiInfo.path, hiInfo.token, it.hiResFile, {
                  contentType: it.hiResFile.type,
                  upsert: false
                });
              if (!hiErr) hiResPath = hiInfo.path;
            }
          }

          done++;
          setProgress(`${done}/${total} caricate`);
          setStatus(idx, 'done');

          return { folderId, path: uploadInfo.path, caption: it.caption || undefined, hiResPath };
        })
      );

      // 3. Registra in DB
      const recRes = await fetch('/api/admin/record-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: mainResults })
      });

      if (!recRes.ok) {
        const b = await recRes.json().catch(() => ({}));
        throw new Error(b.message ?? 'Errore nella registrazione');
      }

      setProgress('Completato!');
      setTimeout(() => {
        items.forEach((it) => URL.revokeObjectURL(it.preview));
        setItems([]);
        setProgress('');
        router.refresh();
      }, 1200);
    } catch (err) {
      console.error('[PhotoUploader]', err);
      setProgress(`Errore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/15 disabled:opacity-50"
        >
          + Seleziona foto
        </button>
        {items.length > 0 && !uploading && (
          <button
            type="button"
            onClick={uploadAll}
            className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90"
          >
            Carica {items.length} {items.length === 1 ? 'foto' : 'foto'}
          </button>
        )}
        {uploading && (
          <span className="text-xs uppercase tracking-[0.24em] text-white/70">
            {progress || 'Caricamento…'}
          </span>
        )}
        {!uploading && progress && (
          <span className="text-xs uppercase tracking-[0.24em] text-emerald-300">{progress}</span>
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

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it, idx) => (
            <div
              key={idx}
              className={`relative rounded-xl border p-3 text-xs ${
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
                <img
                  src={it.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {it.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white">
                      Caricamento…
                    </span>
                  </div>
                )}
                {it.status === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-lg">✓</span>
                  </div>
                )}
              </div>

              {/* Caption */}
              <input
                value={it.caption}
                onChange={(e) => setCaption(idx, e.target.value)}
                placeholder="Didascalia (opzionale)"
                disabled={uploading}
                className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-white/30 disabled:opacity-50"
              />

              {/* Hi-res */}
              <label className="flex cursor-pointer items-center gap-2 text-muted hover:text-white">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => setHiRes(idx, e.target.files?.[0] ?? null)}
                />
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  {it.hiResFile ? `Hi-res: ${it.hiResFile.name.slice(0, 18)}…` : '+ Hi-res (opzionale)'}
                </span>
              </label>

              {it.error && <p className="mt-1 text-rose-300">{it.error}</p>}

              {!uploading && it.status === 'idle' && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
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

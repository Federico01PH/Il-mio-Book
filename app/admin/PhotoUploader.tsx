'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FileItem {
  id: string;
  file: File;
  preview: string;
  caption: string;
  hiResFile: File | null;
  progress: number; // 0-100
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
  const [summary, setSummary] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newItems: FileItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      preview: URL.createObjectURL(f),
      caption: '',
      hiResFile: null,
      progress: 0,
      status: 'idle'
    }));
    setItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateItem(id: string, patch: Partial<FileItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function uploadOne(item: FileItem): Promise<'done' | 'error'> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append('folderId', folderId);
      fd.append('file', item.file);
      if (item.caption) fd.append('caption', item.caption);
      if (item.hiResFile) fd.append('hiRes', item.hiResFile);

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          updateItem(item.id, { progress: Math.round((e.loaded / e.total) * 90) });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updateItem(item.id, { status: 'done', progress: 100 });
          resolve('done');
        } else {
          let msg = `Errore ${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText);
            msg = body.message ?? msg;
          } catch {}
          updateItem(item.id, { status: 'error', error: msg, progress: 0 });
          resolve('error');
        }
      };

      xhr.onerror = () => {
        updateItem(item.id, { status: 'error', error: 'Errore di rete', progress: 0 });
        resolve('error');
      };

      xhr.open('POST', '/api/admin/upload-photo');
      xhr.send(fd);
      updateItem(item.id, { status: 'uploading', progress: 5 });
    });
  }

  async function uploadAll() {
    const toUpload = items.filter((it) => it.status === 'idle');
    if (toUpload.length === 0 || uploading) return;
    setUploading(true);
    setSummary('');

    // Upload sequenziale: Supabase Storage su free tier non regge connessioni
    // simultanee dal medesimo processo Node.js → fetch failed su 3+ concorrenti.
    let done = 0;
    let errors = 0;

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
          <span className="text-xs uppercase tracking-[0.24em] text-white/70 animate-pulse">
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

      {/* Griglia file */}
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

                {/* Barra progresso */}
                {it.status === 'uploading' && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                )}

                {it.status === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xl">
                    ✓
                  </div>
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

              {/* Hi-res */}
              {it.status === 'idle' && (
                <label className="flex cursor-pointer items-center text-xs text-muted hover:text-white">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => updateItem(it.id, { hiResFile: e.target.files?.[0] ?? null })}
                  />
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    {it.hiResFile ? `Hi-res: ${it.hiResFile.name.slice(0, 16)}…` : '+ Hi-res'}
                  </span>
                </label>
              )}

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

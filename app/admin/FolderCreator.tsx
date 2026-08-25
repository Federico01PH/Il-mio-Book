'use client';

import { useRef, useState } from 'react';
import { createFolder } from './actions';

/** Comprime l'immagine a max 1920 px lato lungo, JPEG 82% via Canvas,
 *  cosi' la cover pesa poche centinaia di KB e passa il limite di Vercel. */
function compressToJpeg(file: File, maxPx = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas non disponibile'));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compressione fallita'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossibile leggere il file'));
    };
    img.src = url;
  });
}

export default function FolderCreator() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    const file = (form.elements.namedItem('cover') as HTMLInputElement).files?.[0];

    if (name.length < 2) {
      setError('Il nome della cartella deve avere almeno 2 caratteri.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('name', name);
      fd.set('description', description);
      if (file && file.size > 0) {
        const blob = await compressToJpeg(file);
        fd.set('cover', blob, 'cover.jpg');
      }
      await createFolder(fd); // in caso di successo fa il redirect a /admin?saved=folder
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Errore imprevisto durante la creazione.');
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-2xl border border-white/10 bg-black/60 p-5 sm:grid-cols-2"
    >
      <label className="block text-xs text-muted">
        Nome cartella
        <input
          name="name"
          required
          minLength={2}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        />
      </label>
      <label className="block text-xs text-muted">
        Cover (opzionale)
        <input
          ref={inputRef}
          type="file"
          name="cover"
          accept="image/*"
          className="mt-2 w-full text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.2em] file:text-white"
        />
      </label>
      <label className="block text-xs text-muted sm:col-span-2">
        Descrizione (opzionale)
        <textarea
          name="description"
          rows={2}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        />
      </label>
      {error && (
        <p className="sm:col-span-2 text-xs text-rose-300">{error}</p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Creazione…' : 'Crea cartella'}
        </button>
      </div>
    </form>
  );
}

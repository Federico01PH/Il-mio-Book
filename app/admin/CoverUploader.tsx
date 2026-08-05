'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateFolderCover } from './actions';

/** Comprime l'immagine a max 1920 px lato lungo, JPEG 82% via Canvas.
 *  Cosi la cover pesa poche centinaia di KB e passa il limite di Vercel. */
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

export default function CoverUploader({
  folderId,
  hasCover
}: {
  folderId: string;
  hasCover: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setStatus('working');
    setError('');
    try {
      const blob = await compressToJpeg(file);
      const fd = new FormData();
      fd.set('id', folderId);
      fd.set('cover', blob, 'cover.jpg');
      await updateFolderCover(fd);
      setStatus('done');
      router.refresh();
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'working'}
        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'working' ? 'Caricamento…' : hasCover ? 'Cambia cover' : 'Imposta cover'}
      </button>

      {status === 'done' && (
        <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">✓ Cover aggiornata</span>
      )}
      {status === 'error' && (
        <span className="text-[10px] text-rose-300">{error}</span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelect}
      />
    </div>
  );
}

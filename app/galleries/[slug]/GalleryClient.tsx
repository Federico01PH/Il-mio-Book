'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string | null;
  hasHiRes: boolean;
}

const CONTACT_EMAIL = 'fedephazza@gmail.com';

function hiresMailto(caption: string | null, folderName: string): string {
  const subject = encodeURIComponent(
    `Richiesta foto in alta risoluzione: ${caption ?? folderName}`
  );
  const body = encodeURIComponent(
    `Ciao,\n\nVorrei richiedere questa foto in alta risoluzione.\n\nFoto: ${caption ?? '(senza titolo)'}\nCartella: ${folderName}\n\nGrazie!`
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export default function GalleryClient({
  photos,
  folderName
}: {
  photos: GalleryPhoto[];
  folderName: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? photos.find((p) => p.id === openId) ?? null : null;

  const showProtectionMsg = useCallback(() => {
    toast('Vuoi questa foto? Contattami tramite i social o via email 📩', { duration: 5000 });
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  function step(delta: number) {
    if (!openId) return;
    const idx = photos.findIndex((p) => p.id === openId);
    if (idx === -1) return;
    setOpenId(photos[(idx + delta + photos.length) % photos.length].id);
  }

  return (
    <>
      {/* ── Masonry a larghezza piena ── */}
      <div className="columns-2 lg:columns-3 xl:columns-4 gap-x-1.5 sm:gap-x-2">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="break-inside-avoid mb-1.5 sm:mb-2 group relative cursor-zoom-in"
            onClick={() => setOpenId(photo.id)}
          >
            <div className="relative transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:z-10 rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={photo.caption ?? ''}
                className="w-full h-auto block rounded-lg select-none opacity-0"
                style={{ transition: 'opacity 0.35s ease' }}
                loading={index < 8 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
              />
              {/* Overlay: blocca drag e click destro */}
              <div
                className="absolute inset-0 rounded-lg"
                onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                draggable={false}
              />
            </div>
            {photo.caption && (
              <p className="mt-1 text-xs text-gray-400 px-0.5 select-none">{photo.caption}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
            onClick={() => setOpenId(null)}
          >
            {/* Chiudi */}
            <button
              onClick={(e) => { e.stopPropagation(); setOpenId(null); }}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-lg"
              aria-label="Chiudi"
            >
              ×
            </button>

            {/* Freccia sinistra */}
            {photos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-2xl"
                aria-label="Precedente"
              >
                ‹
              </button>
            )}

            {/* Freccia destra */}
            {photos.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); step(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-2xl"
                aria-label="Successiva"
              >
                ›
              </button>
            )}

            {/* Contenuto */}
            <div
              className="flex flex-col items-center gap-4 w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Immagine */}
              <div className="relative flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={open.src}
                  alt={open.caption ?? ''}
                  className="max-h-[80vh] max-w-full w-auto h-auto rounded-xl select-none block"
                  draggable={false}
                />
                {/* Protection overlay */}
                <div
                  className="absolute inset-0 rounded-xl"
                  onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                  draggable={false}
                />
              </div>

              {/* Barra inferiore: caption + bottone hi-res */}
              <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-2xl">
                <span className="text-sm text-white/70 truncate">
                  {open.caption ?? folderName}
                </span>
                <a
                  href={hiresMailto(open.caption, folderName)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black hover:bg-white/90 transition"
                >
                  Richiedi in alta risoluzione
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

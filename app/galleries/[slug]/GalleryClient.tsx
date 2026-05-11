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

/** Numero colonne in base alla larghezza della finestra */
function useColumnCount(): number {
  const [cols, setCols] = useState(2); // mobile-first: 2 col di default (SSR)
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 4 : w >= 768 ? 3 : 2);
    }
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

/** Distribuisce le foto nelle colonne in ordine (come Pinterest) */
function splitColumns(photos: GalleryPhoto[], count: number): GalleryPhoto[][] {
  const cols: GalleryPhoto[][] = Array.from({ length: count }, () => []);
  photos.forEach((p, i) => cols[i % count].push(p));
  return cols;
}

function hiresMailto(caption: string | null, folderName: string): string {
  const subject = encodeURIComponent(`Richiesta foto in alta risoluzione: ${caption ?? folderName}`);
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
  const colCount  = useColumnCount();
  const columns   = splitColumns(photos, colCount);

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
      {/* ── Masonry Pinterest: colonne flex ── */}
      <div className="flex gap-1.5 sm:gap-2">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2">
            {col.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative cursor-zoom-in"
                onClick={() => setOpenId(photo.id)}
              >
                <div className="relative rounded-lg bg-gray-100 overflow-hidden transition-transform duration-300 ease-out group-hover:scale-[1.03] group-hover:shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.caption ?? ''}
                    className="w-full h-auto block select-none opacity-0"
                    style={{ transition: 'opacity 0.35s ease' }}
                    loading={colIdx === 0 && index < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }}
                  />
                  {/* Overlay protezione */}
                  <div
                    className="absolute inset-0"
                    onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                    draggable={false}
                  />
                </div>
                {photo.caption && (
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-400 px-0.5 select-none leading-tight">
                    {photo.caption}
                  </p>
                )}
              </div>
            ))}
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
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-xl leading-none"
              aria-label="Chiudi"
            >×</button>

            {/* Frecce */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); step(-1); }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-2xl"
                  aria-label="Precedente"
                >‹</button>
                <button
                  onClick={(e) => { e.stopPropagation(); step(1); }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-2xl"
                  aria-label="Successiva"
                >›</button>
              </>
            )}

            {/* Contenuto */}
            <div
              className="flex flex-col items-center gap-4 w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Immagine */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={open.src}
                  alt={open.caption ?? ''}
                  className="max-h-[78vh] max-w-full w-auto h-auto rounded-xl select-none block"
                  draggable={false}
                />
                <div
                  className="absolute inset-0 rounded-xl"
                  onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                  draggable={false}
                />
              </div>

              {/* Barra: caption + bottone hi-res */}
              <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-2xl px-1">
                {open.caption && (
                  <span className="text-sm text-white/60 truncate">{open.caption}</span>
                )}
                <a
                  href={hiresMailto(open.caption, folderName)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto shrink-0 rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black hover:bg-white/90 transition"
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

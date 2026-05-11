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

export default function GalleryClient({ photos }: { photos: GalleryPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hiResEmail, setHiResEmail] = useState('');
  const [hiResMessage, setHiResMessage] = useState('');
  const [hiResSubmitting, setHiResSubmitting] = useState(false);

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
    const next = (idx + delta + photos.length) % photos.length;
    setOpenId(photos[next].id);
    setHiResEmail('');
    setHiResMessage('');
  }

  async function submitHiRes() {
    if (!open) return;
    if (!hiResEmail.trim() || !hiResEmail.includes('@')) {
      toast.error('Inserisci un indirizzo email valido.');
      return;
    }
    setHiResSubmitting(true);
    try {
      const res = await fetch('/api/hi-res-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: open.id, email: hiResEmail.trim(), message: hiResMessage || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? 'Invio fallito.');
        return;
      }
      toast.success('Richiesta inviata. Verrai contattato presto.');
      setHiResEmail('');
      setHiResMessage('');
    } catch {
      toast.error('Errore di rete.');
    } finally {
      setHiResSubmitting(false);
    }
  }

  return (
    <>
      {/* ── Masonry grid ── */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="break-inside-avoid mb-3 group relative cursor-zoom-in"
            onClick={() => setOpenId(photo.id)}
          >
            <div className="relative transition-transform duration-300 ease-out group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:z-10 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={photo.caption ?? ''}
                className="w-full h-auto block rounded-xl select-none"
                loading={index < 6 ? 'eager' : 'lazy'}
                draggable={false}
              />
              {/* Overlay trasparente: blocca click destro e drag */}
              <div
                className="absolute inset-0 rounded-xl"
                onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                draggable={false}
              />
            </div>
            {photo.caption && (
              <p className="mt-1.5 text-xs text-gray-400 px-0.5 select-none">{photo.caption}</p>
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
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/96 p-4"
            onClick={() => setOpenId(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setOpenId(null); }}
              className="absolute right-5 top-5 text-white/50 hover:text-white text-xs uppercase tracking-[0.24em] transition"
            >
              Chiudi ×
            </button>

            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); step(-1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-4 text-4xl text-white/40 hover:text-white transition"
                >‹</button>
                <button
                  onClick={(e) => { e.stopPropagation(); step(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-4 text-4xl text-white/40 hover:text-white transition"
                >›</button>
              </>
            )}

            <div
              className="flex flex-col items-center gap-5 w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Immagine a schermo pieno */}
              <div className="relative flex items-center justify-center max-h-[78vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={open.src}
                  alt={open.caption ?? ''}
                  className="max-h-[78vh] max-w-full w-auto h-auto rounded-2xl select-none block"
                  draggable={false}
                />
                <div
                  className="absolute inset-0 rounded-2xl"
                  onContextMenu={(e) => { e.preventDefault(); showProtectionMsg(); }}
                  draggable={false}
                />
              </div>

              {(open.caption || open.hasHiRes) && (
                <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-black/70 p-5 space-y-4">
                  {open.caption && (
                    <p className="text-sm text-white/80">{open.caption}</p>
                  )}
                  {open.hasHiRes && (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Richiedi alta risoluzione</p>
                      <input
                        type="email"
                        value={hiResEmail}
                        onChange={(e) => setHiResEmail(e.target.value)}
                        placeholder="La tua email"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                      />
                      <textarea
                        value={hiResMessage}
                        onChange={(e) => setHiResMessage(e.target.value)}
                        rows={2}
                        placeholder="Messaggio opzionale"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 resize-none"
                      />
                      <button
                        onClick={submitHiRes}
                        disabled={hiResSubmitting}
                        className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:opacity-50"
                      >
                        {hiResSubmitting ? 'Invio…' : 'Invia richiesta'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

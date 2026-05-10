'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string | null;
  hasHiRes: boolean;
}

export default function GalleryClient({ photos }: { photos: GalleryPhoto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [hiResMessage, setHiResMessage] = useState('');
  const [hiResSubmitting, setHiResSubmitting] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
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
    setHiResMessage('');
  }

  const open = openId ? photos.find((p) => p.id === openId) ?? null : null;
  const hover = !isTouch && hoverId ? photos.find((p) => p.id === hoverId) ?? null : null;

  async function submitHiRes() {
    if (!open) return;
    setHiResSubmitting(true);
    try {
      const res = await fetch('/api/hi-res-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: open.id, message: hiResMessage || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message ?? 'Invio fallito.');
        return;
      }
      toast.success('Richiesta inviata. Riceverai una risposta via email.');
      setHiResMessage('');
    } catch (err) {
      console.error(err);
      toast.error('Errore di rete.');
    } finally {
      setHiResSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenId(photo.id)}
            onMouseEnter={() => setHoverId(photo.id)}
            onMouseLeave={() => setHoverId((id) => (id === photo.id ? null : id))}
            className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-black/70 p-0 text-left transition hover:-translate-y-0.5 hover:border-white/20"
          >
            <div className="relative h-80 w-full overflow-hidden">
              <Image
                src={photo.src}
                alt={photo.caption ?? 'Foto'}
                fill
                sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            {photo.caption ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4">
                <p className="text-sm font-medium text-white">{photo.caption}</p>
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {/* Mouse-only floating preview */}
      <AnimatePresence>
        {hover ? (
          <motion.div
            key={hover.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed bottom-6 right-6 hidden h-64 w-64 overflow-hidden rounded-3xl border border-white/15 bg-black/80 shadow-2xl shadow-black/50 lg:block"
          >
            <Image src={hover.src} alt="" fill sizes="256px" className="object-cover" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
            onClick={() => setOpenId(null)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenId(null);
              }}
              aria-label="Chiudi"
              className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white hover:bg-black/80"
            >
              Chiudi
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Precedente"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 px-4 py-3 text-white hover:bg-black/80"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Successiva"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/60 px-4 py-3 text-white hover:bg-black/80"
            >
              ›
            </button>

            <div
              className="relative flex max-h-full w-full max-w-6xl flex-col items-center gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative max-h-[75vh] w-full">
                <img
                  src={open.src}
                  alt={open.caption ?? ''}
                  className="mx-auto max-h-[75vh] w-auto rounded-2xl object-contain"
                />
              </div>

              <div className="w-full max-w-3xl space-y-3 rounded-3xl border border-white/10 bg-black/60 p-6">
                {open.caption ? (
                  <p className="text-sm text-white/90">{open.caption}</p>
                ) : null}
                {open.hasHiRes ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-muted">Versione alta risoluzione</p>
                    <textarea
                      value={hiResMessage}
                      onChange={(e) => setHiResMessage(e.target.value)}
                      rows={2}
                      placeholder="Messaggio facoltativo per il fotografo"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/40"
                    />
                    <button
                      onClick={submitHiRes}
                      disabled={hiResSubmitting}
                      className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {hiResSubmitting ? 'Invio…' : 'Richiedi alta risoluzione'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

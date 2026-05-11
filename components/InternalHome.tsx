'use client';

import { useMemo, useState, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

const FALLBACK_SLIDES = [
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1526318472351-bc152f9a1026?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80'
];

interface BioProps {
  name: string;
  title: string;
  text: string;
  avatarUrl: string | null;
  whatsapp: string;
  telegram: string;
  instagram: string;
}

export default function InternalHome({
  slides,
  bio
}: {
  slides?: string[];
  bio?: BioProps;
}) {
  const finalSlides = slides && slides.length > 0 ? slides : FALLBACK_SLIDES;
  const [emblaRef] = useEmblaCarousel({ loop: true, skipSnaps: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => [
      { title: 'Gallerie', href: '/galleries' },
      { title: 'Bio', href: '#bio' },
      { title: 'Canali', href: '#bio' }
    ],
    []
  );

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function scrollToBio() {
    bioRef.current?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }

  const contacts = [
    bio?.whatsapp && { label: 'WhatsApp', href: bio.whatsapp },
    bio?.telegram && { label: 'Telegram', href: bio.telegram },
    bio?.instagram && { label: 'Instagram', href: bio.instagram }
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="relative bg-black text-text">
      {/* ─── CAROUSEL (100vh) ─── */}
      <div className="relative h-screen overflow-hidden">
        <div className="absolute inset-0">
          <div className="embla h-full" ref={emblaRef}>
            <div className="embla__container flex h-full">
              {finalSlides.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="embla__slide relative h-screen min-w-full overflow-hidden"
                >
                  <motion.img
                    src={src}
                    alt={`Immagine ${index + 1}`}
                    className="h-full w-full object-cover"
                    initial={{ opacity: 0.85 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2 }}
                  />
                  <div className="absolute inset-0 bg-black/35" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* nav */}
        <div className="relative z-10 flex h-full flex-col justify-between p-6">
          <header className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-[0.28em] text-white">Portfolio</span>
            <nav className="hidden md:flex space-x-4 text-sm uppercase tracking-[0.24em] text-white/90">
              <Link href="/galleries" className="transition hover:text-white">Gallerie</Link>
              <button onClick={scrollToBio} className="transition hover:text-white">Bio</button>
            </nav>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white"
              aria-expanded={menuOpen}
            >
              {menuOpen ? 'Chiudi' : 'Menu'}
            </button>
          </header>

          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="md:hidden absolute left-6 right-6 top-20 rounded-3xl border border-white/10 bg-black/85 p-6 backdrop-blur"
              >
                <ul className="space-y-3 text-sm uppercase tracking-[0.24em] text-white/90">
                  <li><Link href="/galleries" onClick={() => setMenuOpen(false)} className="block py-1">Gallerie</Link></li>
                  <li><button onClick={scrollToBio} className="block py-1">Bio</button></li>
                </ul>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* hero text */}
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-semibold tracking-[0.2em] text-white md:text-6xl"
            >
              {bio?.name ?? 'Portfolio'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.1 }}
              className="max-w-2xl text-base leading-8 text-white/80"
            >
              {bio?.title ?? 'Fotografo'}
            </motion.p>
            <Link
              href="/galleries"
              className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.26em] text-white transition hover:bg-white/15"
            >
              Esplora le gallerie
            </Link>
          </div>

          {/* scroll indicator */}
          <div className="flex justify-center pb-2">
            <button
              onClick={scrollToBio}
              className="flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition"
              aria-label="Scorri verso il basso"
            >
              <span className="text-[10px] uppercase tracking-[0.28em]">Scopri</span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </motion.div>
            </button>
          </div>
        </div>
      </div>

      {/* ─── BIO SECTION ─── */}
      <div ref={bioRef} id="bio" className="min-h-screen flex items-center justify-center px-6 py-20 bg-surface">
        <div className="w-full max-w-2xl space-y-10 text-center">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/15 bg-white/5 shadow-2xl shadow-black/50">
              {bio?.avatarUrl ? (
                <Image
                  src={bio.avatarUrl}
                  alt={bio.name}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : null}
            </div>
          </motion.div>

          {/* Testo */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <p className="text-xs uppercase tracking-[0.32em] text-muted">{bio?.title ?? 'Fotografo'}</p>
            <h2 className="text-4xl font-semibold text-white">{bio?.name ?? 'Federico Azzarito'}</h2>
            {bio?.text ? (
              <p className="mx-auto max-w-xl whitespace-pre-line text-base leading-8 text-muted">
                {bio.text}
              </p>
            ) : null}
          </motion.div>

          {/* Contatti social */}
          {contacts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className={`grid gap-3 ${contacts.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : contacts.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
            >
              {contacts.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-3xl border border-white/10 bg-black/70 px-6 py-4 text-sm uppercase tracking-[0.2em] text-white transition hover:bg-white/5 hover:border-white/20"
                >
                  {c.label}
                </a>
              ))}
            </motion.div>
          )}

          {/* Link gallerie */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link
              href="/galleries"
              className="text-xs uppercase tracking-[0.28em] text-muted hover:text-white transition"
            >
              Vedi le gallerie →
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

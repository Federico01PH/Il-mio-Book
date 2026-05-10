'use client';

import { useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const FALLBACK_SLIDES = [
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1526318472351-bc152f9a1026?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80'
];

export default function InternalHome({ slides }: { slides?: string[] }) {
  const finalSlides = slides && slides.length > 0 ? slides : FALLBACK_SLIDES;
  const [emblaRef] = useEmblaCarousel({ loop: true, skipSnaps: false });
  const [menuOpen, setMenuOpen] = useState(false);

  const items = useMemo(
    () => [
      { title: 'Gallerie', href: '/galleries' },
      { title: 'Bio', href: '/bio' },
      { title: 'Canali', href: '/bio#contacts' }
    ],
    []
  );

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-text">
      <div className="absolute inset-0">
        <div className="embla h-full" ref={emblaRef}>
          <div className="embla__container flex h-full">
            {finalSlides.map((src, index) => (
              <div key={`${src}-${index}`} className="embla__slide relative h-screen min-w-full overflow-hidden">
                <motion.img
                  src={src}
                  alt={`Immagine ${index + 1}`}
                  className="h-full w-full object-cover"
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2 }}
                />
                <div className="absolute inset-0 bg-black/30" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm uppercase tracking-[0.28em] text-white">
            Portfolio
          </Link>
          <nav className="hidden md:flex space-x-4 text-sm uppercase tracking-[0.24em] text-white/90">
            {items.map((item) => (
              <Link key={item.title} href={item.href} className="transition hover:text-white">
                {item.title}
              </Link>
            ))}
            <button onClick={logout} className="text-white/70 hover:text-white">
              Esci
            </button>
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
          {menuOpen ? (
            <motion.nav
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="md:hidden absolute left-6 right-6 top-20 rounded-3xl border border-white/10 bg-black/85 p-6 backdrop-blur"
            >
              <ul className="space-y-3 text-sm uppercase tracking-[0.24em] text-white/90">
                {items.map((item) => (
                  <li key={item.title}>
                    <Link href={item.href} onClick={() => setMenuOpen(false)} className="block py-1">
                      {item.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <button onClick={logout} className="block py-1 text-white/70">
                    Esci
                  </button>
                </li>
              </ul>
            </motion.nav>
          ) : null}
        </AnimatePresence>

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-semibold tracking-[0.2em] text-white md:text-6xl"
          >
            Portfolio riservato
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.1 }}
            className="max-w-2xl text-base leading-8 text-white/80"
          >
            Esplora i book fotografici in un’esperienza minimale e immersiva. Solo utenti approvati possono navigare.
          </motion.p>
          <Link
            href="/galleries"
            className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.26em] text-white transition hover:bg-white/15"
          >
            Esplora le gallerie
          </Link>
        </div>
      </div>
    </div>
  );
}

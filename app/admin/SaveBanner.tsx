'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  approve: "Accesso approvato. L'utente entra al prossimo refresh.",
  reject: 'Richiesta rifiutata.',
  revoke: 'Accesso revocato.',
  hires: 'Richiesta hi-res segnata come inviata.',
  folder: 'Cartella creata.',
  'folder-deleted': 'Cartella eliminata.',
  photo: 'Foto caricata.',
  'photo-deleted': 'Foto eliminata.',
  settings: 'Impostazioni salvate.'
};

export default function SaveBanner({ saved }: { saved?: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(saved));

  useEffect(() => {
    if (!saved) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      router.replace('/admin');
    }, 3500);
    return () => clearTimeout(t);
  }, [saved, router]);

  if (!visible || !saved) return null;
  const message = MESSAGES[saved] ?? 'Operazione completata.';

  return (
    <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2">
      <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-xs uppercase tracking-[0.24em] text-emerald-200 shadow-lg">
        {'✓'} {message}
      </div>
    </div>
  );
}

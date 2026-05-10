import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import supabaseAdmin from '../../lib/supabaseServer';
import { publicPhotoUrl } from '../../lib/storage';

export const metadata: Metadata = { title: 'Bio' };
export const dynamic = 'force-dynamic';

interface SettingsMap {
  bio_title?: string;
  bio_text?: string;
  bio_avatar_path?: string;
  whatsapp_url?: string;
  telegram_url?: string;
  instagram_url?: string;
}

async function loadSettings(): Promise<SettingsMap> {
  const { data } = await supabaseAdmin.from('site_settings').select('key,value');
  const map: SettingsMap = {};
  for (const row of data ?? []) {
    (map as Record<string, string>)[row.key] = row.value ?? '';
  }
  return map;
}

export default async function BioPage() {
  const s = await loadSettings();
  const avatar = publicPhotoUrl(s.bio_avatar_path || null);

  const contacts: { label: string; href: string }[] = [];
  if (s.whatsapp_url) contacts.push({ label: 'WhatsApp', href: s.whatsapp_url });
  if (s.telegram_url) contacts.push({ label: 'Telegram', href: s.telegram_url });
  if (s.instagram_url) contacts.push({ label: 'Instagram', href: s.instagram_url });

  return (
    <main className="min-h-screen bg-surface px-6 py-16 text-text">
      <section className="container mx-auto max-w-2xl space-y-10 text-center">
        <Link
          href="/"
          className="block text-xs uppercase tracking-[0.3em] text-muted hover:text-white"
        >
          ← Home
        </Link>

        <div className="flex justify-center">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border border-white/10 bg-white/5">
            {avatar ? (
              <Image src={avatar} alt="Profilo" fill sizes="128px" className="object-cover" />
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Biografia</p>
          <h1 className="text-4xl font-semibold">{s.bio_title || 'Fotografo'}</h1>
          <p className="whitespace-pre-line text-base leading-8 text-muted">
            {s.bio_text || 'Aggiungi la tua bio dalla dashboard admin.'}
          </p>
        </div>

        {contacts.length > 0 ? (
          <div id="contacts" className="grid gap-4 sm:grid-cols-3">
            {contacts.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-3xl border border-white/10 bg-black/70 px-6 py-4 text-sm uppercase tracking-[0.2em] text-white transition hover:bg-white/5"
              >
                {c.label}
              </a>
            ))}
          </div>
        ) : (
          <p id="contacts" className="text-xs uppercase tracking-[0.28em] text-muted">
            Canali in arrivo
          </p>
        )}
      </section>
    </main>
  );
}

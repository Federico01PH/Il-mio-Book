import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import supabaseAdmin from '../../lib/supabaseServer';
import { publicPhotoUrl } from '../../lib/storage';

export const metadata: Metadata = { title: 'Bio' };
export const dynamic = 'force-dynamic';

async function loadSettings(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin.from('site_settings').select('key,value');
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value ?? '';
  return map;
}

export default async function BioPage() {
  const s = await loadSettings();
  const avatar = publicPhotoUrl(s.bio_avatar_path || null);

  const contacts = [
    s.whatsapp_url && { label: 'WhatsApp', href: s.whatsapp_url },
    s.telegram_url && { label: 'Telegram', href: s.telegram_url },
    s.instagram_url && { label: 'Instagram', href: s.instagram_url }
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <main className="min-h-screen bg-white px-6 py-16">
      <section className="mx-auto max-w-xl space-y-10 text-center">
        <Link
          href="/"
          className="block text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-gray-700 transition"
        >
          ← Home
        </Link>

        <div className="flex justify-center">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
            {avatar ? (
              <Image src={avatar} alt="Profilo" fill sizes="128px" className="object-cover" />
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Biografia</p>
          <h1 className="text-3xl font-semibold text-gray-900">{s.bio_title || 'Fotografo'}</h1>
          <p className="whitespace-pre-line text-base leading-8 text-gray-500">
            {s.bio_text || 'Aggiungi la tua bio dalla dashboard admin.'}
          </p>
        </div>

        {contacts.length > 0 && (
          <div className={`grid gap-3 ${contacts.length === 1 ? 'max-w-xs mx-auto' : contacts.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {contacts.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 text-sm uppercase tracking-[0.2em] text-gray-700 transition hover:bg-gray-100 hover:border-gray-300"
              >
                {c.label}
              </a>
            ))}
          </div>
        )}

        <Link
          href="/galleries"
          className="inline-block text-xs uppercase tracking-[0.28em] text-gray-400 hover:text-gray-700 transition"
        >
          Vedi le gallerie →
        </Link>
      </section>
    </main>
  );
}

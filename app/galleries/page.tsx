import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import supabaseAdmin from '../../lib/supabaseServer';
import { publicPhotoUrl } from '../../lib/storage';

export const metadata: Metadata = { title: 'Gallerie' };
export const dynamic = 'force-dynamic';

export default async function GalleriesPage() {
  const { data: folders } = await supabaseAdmin
    .from('folders')
    .select('id,name,slug,description,cover_storage_path')
    .order('sort_order', { ascending: true });

  const items = (folders ?? []).map((f) => ({
    ...f,
    cover_url: publicPhotoUrl(f.cover_storage_path)
  }));

  return (
    <main className="min-h-screen bg-surface px-6 py-12 text-text">
      <section className="container mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Gallerie</p>
            <h1 className="text-4xl font-semibold">I book fotografici</h1>
            <p className="max-w-2xl text-sm leading-7 text-muted">
              Scorri le cartelle e scopri le foto curate per ogni progetto.
            </p>
          </div>
          <Link href="/" className="text-xs uppercase tracking-[0.28em] text-muted hover:text-white">
            ← Home
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-black/40 p-16 text-center text-sm text-muted">
            Nessuna cartella ancora pubblicata.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((g) => (
              <Link
                key={g.id}
                href={`/galleries/${g.slug}`}
                className="group block overflow-hidden rounded-[28px] border border-white/10 bg-black/70 transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative h-72 overflow-hidden bg-white/5">
                  {g.cover_url ? (
                    <Image
                      src={g.cover_url}
                      alt={g.name}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.28em] text-muted">
                      Cover mancante
                    </div>
                  )}
                </div>
                <div className="border-t border-white/10 px-6 py-5">
                  <h2 className="text-xl font-semibold">{g.name}</h2>
                  <span className="mt-2 block text-sm text-muted">
                    {g.description ?? 'Entra nella cartella'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

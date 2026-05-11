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
    <main className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.32em] text-gray-400">Portfolio</p>
            <h1 className="text-3xl font-semibold text-gray-900 uppercase tracking-[0.16em]">
              Gallerie
            </h1>
          </div>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.28em] text-gray-400 hover:text-gray-700 transition"
          >
            ← Home
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 p-16 text-center text-sm text-gray-400">
            Nessuna galleria pubblicata.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((g) => (
              <Link
                key={g.id}
                href={`/galleries/${g.slug}`}
                className="group block overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 transition hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="relative h-64 overflow-hidden bg-gray-100">
                  {g.cover_url ? (
                    <Image
                      src={g.cover_url}
                      alt={g.name}
                      fill
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.28em] text-gray-300">
                      Nessuna cover
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 px-5 py-4">
                  <h2 className="text-base font-semibold text-gray-900 uppercase tracking-[0.12em]">
                    {g.name}
                  </h2>
                  <span className="mt-1 block text-sm text-gray-400">
                    {g.description ?? 'Vedi la galleria →'}
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

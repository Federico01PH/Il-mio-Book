import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import supabaseAdmin from '../../../lib/supabaseServer';
import { publicPhotoUrl } from '../../../lib/storage';
import GalleryClient from './GalleryClient';

interface PageProps {
  params: { slug: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { data } = await supabaseAdmin
    .from('folders')
    .select('name')
    .eq('slug', params.slug)
    .single();
  return { title: data?.name ?? 'Galleria' };
}

export default async function GalleryDetailPage({ params }: PageProps) {
  const { data: folder } = await supabaseAdmin
    .from('folders')
    .select('id,name,description')
    .eq('slug', params.slug)
    .single();

  if (!folder) notFound();

  const { data: photosRaw } = await supabaseAdmin
    .from('photos')
    .select('id,storage_path,caption,hi_res_storage_path')
    .eq('folder_id', folder.id)
    .order('sort_order', { ascending: true });

  const photos = (photosRaw ?? []).map((p) => ({
    id: p.id,
    src: publicPhotoUrl(p.storage_path) ?? '',
    caption: p.caption,
    hasHiRes: Boolean(p.hi_res_storage_path)
  }));

  return (
    <main className="min-h-screen bg-surface px-6 py-12 text-text">
      <section className="container mx-auto space-y-8">
        <div className="flex flex-col gap-3">
          <Link href="/galleries" className="text-xs uppercase tracking-[0.3em] text-muted hover:text-white">
            ← Torna alle gallerie
          </Link>
          <h1 className="text-4xl font-semibold uppercase tracking-[0.18em]">{folder.name}</h1>
          {folder.description ? (
            <p className="max-w-2xl text-sm leading-7 text-muted">{folder.description}</p>
          ) : (
            <p className="max-w-2xl text-sm leading-7 text-muted">
              Seleziona una foto per aprire la vista ampliata. Su desktop si attiva una preview al passaggio del mouse.
            </p>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-black/40 p-16 text-center text-sm text-muted">
            Nessuna foto in questa cartella.
          </div>
        ) : (
          <GalleryClient photos={photos} />
        )}
      </section>
    </main>
  );
}

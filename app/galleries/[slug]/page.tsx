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

  const [{ data: photosRaw }] = await Promise.all([
    supabaseAdmin
      .from('photos')
      .select('id,storage_path,caption,hi_res_storage_path')
      .eq('folder_id', folder.id)
      .order('sort_order', { ascending: true }),
    supabaseAdmin.from('visits').insert({ page: folder.name }).then(() => null, () => null)
  ]);

  type PhotoRow = { id: string; storage_path: string; caption: string | null; hi_res_storage_path: string | null };
  const photos = (photosRaw ?? [] as PhotoRow[]).map((p) => ({
    id: p.id,
    src: publicPhotoUrl(p.storage_path) ?? '',
    caption: p.caption,
    hasHiRes: Boolean(p.hi_res_storage_path)
  }));

  return (
    <main className="min-h-screen bg-white">
      {/* Header con margini contenuti */}
      <div className="px-4 pt-10 pb-6 sm:px-6 mx-auto max-w-screen-2xl">
        <div className="flex flex-col gap-3">
          <Link
            href="/galleries"
            className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-gray-700 transition"
          >
            ← Gallerie
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 uppercase tracking-[0.18em]">
            {folder.name}
          </h1>
          {folder.description && (
            <p className="max-w-2xl text-sm leading-7 text-gray-500">{folder.description}</p>
          )}
        </div>
      </div>

      {/* Griglia foto a larghezza piena */}
      {photos.length === 0 ? (
        <div className="mx-4 rounded-3xl border border-dashed border-gray-200 p-16 text-center text-sm text-gray-400">
          Nessuna foto in questa galleria.
        </div>
      ) : (
        <div className="px-2 sm:px-3 pb-12">
          <GalleryClient photos={photos} folderName={folder.name} />
        </div>
      )}
    </main>
  );
}

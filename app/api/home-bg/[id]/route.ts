import { NextResponse } from 'next/server';
import sharp from 'sharp';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { HIRES_BUCKET, PHOTOS_BUCKET, publicPhotoUrl } from '../../../../lib/storage';
import { backgroundStoragePath, BACKGROUND_MAX_PX, BACKGROUND_QUALITY } from '../../../../lib/homeSlides';

/**
 * Versione "da sfondo" di una foto. Le anteprime pubbliche sono a 1200 px e a
 * tutto schermo si vedono sgranate; l'originale nel bucket privato hi-res non
 * va esposto. Quindi al primo passaggio genero una via di mezzo pensata per lo
 * schermo, la salvo nel bucket pubblico e da li' in poi rimando direttamente a
 * quel file: il lavoro pesante si paga una volta sola per foto.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Il file generato non cambia mai; se manca l'originale ritento al giro dopo. */
const REDIRECT_HEADERS = { 'Cache-Control': 'public, max-age=3600' };
const FALLBACK_HEADERS = { 'Cache-Control': 'no-store' };

function redirectTo(url: string, headers: Record<string, string>) {
  return NextResponse.redirect(url, { status: 302, headers });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('storage_path,hi_res_storage_path')
    .eq('id', params.id)
    .single();

  if (!photo) return new NextResponse('Foto non trovata', { status: 404 });

  const preview = publicPhotoUrl(photo.storage_path);
  const fallback = () =>
    preview
      ? redirectTo(preview, FALLBACK_HEADERS)
      : new NextResponse('Foto non disponibile', { status: 404 });

  const backgroundPath = backgroundStoragePath(params.id);
  const backgroundUrl = publicPhotoUrl(backgroundPath);
  if (!backgroundUrl) return fallback();

  // Gia' generata in passato: nessun lavoro da rifare.
  const { data: existing } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .list('home-bg', { search: `${params.id}.jpg`, limit: 1 });
  if (existing && existing.length > 0) return redirectTo(backgroundUrl, REDIRECT_HEADERS);

  // Senza originale non c'e' niente da migliorare.
  if (!photo.hi_res_storage_path) return fallback();

  const { data: file, error } = await supabaseAdmin.storage
    .from(HIRES_BUCKET)
    .download(photo.hi_res_storage_path);
  if (error || !file) return fallback();

  const resized = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate() // rispetta l'orientamento EXIF
    .resize({
      width: BACKGROUND_MAX_PX,
      height: BACKGROUND_MAX_PX,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: BACKGROUND_QUALITY, mozjpeg: true })
    .toBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(backgroundPath, resized, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    // Storage pieno o non scrivibile: almeno servo l'immagine appena creata.
    return new NextResponse(resized, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' }
    });
  }

  return redirectTo(backgroundUrl, REDIRECT_HEADERS);
}

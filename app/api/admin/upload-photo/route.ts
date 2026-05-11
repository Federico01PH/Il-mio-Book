import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';
import { randomToken } from '../../../../lib/auth';
import { notifyNewPhoto } from '../../../../lib/telegram';

export const runtime = 'nodejs';

const PREVIEW_MAX_PX = 1200;
const PREVIEW_QUALITY = 80;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tenta l'upload fino a `attempts` volte con back-off esponenziale. */
async function uploadWithRetry(
  bucket: string,
  path: string,
  buffer: Buffer,
  opts: { contentType: string; upsert: boolean },
  attempts = 3
): Promise<{ message: string } | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, opts);
      if (!error) return null;
      const isTransient = /fetch failed|econnreset|timeout/i.test(error.message);
      if (!isTransient || i === attempts - 1) return error;
      console.warn(`[upload-photo] retry ${i + 1}/${attempts - 1} dopo: ${error.message}`);
    } catch (e) {
      if (i === attempts - 1) throw e;
      console.warn(`[upload-photo] retry ${i + 1}/${attempts - 1} dopo eccezione:`, e);
    }
    await sleep(600 * 2 ** i);
  }
  return null;
}

/** Comprime l'immagine a max PREVIEW_MAX_PX lato lungo, qualità PREVIEW_QUALITY. */
async function compressForPreview(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()                       // rispetta l'orientamento EXIF
    .resize(PREVIEW_MAX_PX, PREVIEW_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: PREVIEW_QUALITY, progressive: false, mozjpeg: true })
    .toBuffer();
}

export async function POST(request: Request) {
  // 1. Auth
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') {
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  // 2. Parsing FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: `FormData non valida: ${msg}` }, { status: 400 });
  }

  const folderId  = String(formData.get('folderId') ?? '').trim();
  const caption   = String(formData.get('caption')  ?? '').trim() || null;
  const file      = formData.get('file')  as File | null;
  const hiResFile = formData.get('hiRes') as File | null;

  if (!folderId || !file || file.size === 0) {
    return NextResponse.json({ message: 'folderId e file sono obbligatori.' }, { status: 400 });
  }

  // 3. Verifica cartella
  const { data: folder, error: folderErr } = await supabaseAdmin
    .from('folders')
    .select('slug,name')
    .eq('id', folderId)
    .single();

  if (folderErr || !folder) {
    return NextResponse.json({ message: 'Cartella non trovata.' }, { status: 404 });
  }

  // 4. Leggi originale
  let originalBuffer: Buffer;
  try {
    originalBuffer = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: `Lettura file fallita: ${msg}` }, { status: 500 });
  }

  // 5. Comprimi per la preview (max 1200px, JPEG 80%)
  let previewBuffer: Buffer;
  try {
    previewBuffer = await compressForPreview(originalBuffer);
    console.log(
      '[upload-photo] compresso %dKB → %dKB',
      Math.round(originalBuffer.length / 1024),
      Math.round(previewBuffer.length / 1024)
    );
  } catch (e) {
    console.warn('[upload-photo] compressione fallita, uso originale:', e);
    previewBuffer = originalBuffer;
  }

  // 6. Upload preview compressa → bucket "photos"
  const base = `${Date.now()}-${randomToken(6)}`;
  const photoPath = `${folder.slug}/${base}.jpg`;

  let uploadError: { message: string } | null = null;
  try {
    uploadError = await uploadWithRetry(
      PHOTOS_BUCKET,
      photoPath,
      previewBuffer,
      { contentType: 'image/jpeg', upsert: false }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { message: `Connessione Supabase fallita: ${msg}. Il progetto potrebbe essere in pausa.` },
      { status: 500 }
    );
  }

  if (uploadError) {
    const low = uploadError.message.toLowerCase();
    const isBucketMissing = low.includes('bucket') || low.includes('not found') || low.includes('no such');
    return NextResponse.json(
      {
        message: isBucketMissing
          ? `Bucket "${PHOTOS_BUCKET}" non trovato. Crealo su Supabase → Storage.`
          : `Upload fallito: ${uploadError.message}`
      },
      { status: 500 }
    );
  }

  // 7. Upload originale → bucket "hi-res" (automatico per ogni foto)
  //    Se l'admin ha caricato un file hi-res separato, usa quello.
  const hiSrc    = hiResFile && hiResFile.size > 0 ? hiResFile : null;
  const hiBuffer = hiSrc
    ? Buffer.from(await hiSrc.arrayBuffer())
    : originalBuffer;
  const hiExt    = hiSrc
    ? (hiSrc.name.split('.').pop() ?? 'jpg').toLowerCase()
    : (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const hiPath   = `${folder.slug}/${base}-original.${hiExt}`;

  let hiResPath: string | null = null;
  try {
    const { error: hiErr } = await supabaseAdmin.storage
      .from(HIRES_BUCKET)
      .upload(hiPath, hiBuffer, { contentType: hiSrc?.type ?? file.type, upsert: false });
    if (hiErr) {
      console.warn('[upload-photo] hi-res upload fallito (non bloccante):', hiErr.message);
    } else {
      hiResPath = hiPath;
    }
  } catch (e) {
    console.warn('[upload-photo] hi-res exception (non bloccante):', e);
  }

  // 8. Registra in DB
  const { error: dbErr } = await supabaseAdmin.from('photos').insert({
    folder_id: folderId,
    storage_path: photoPath,
    caption,
    hi_res_storage_path: hiResPath
  });

  if (dbErr) {
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([photoPath]).catch(() => null);
    return NextResponse.json({ message: `Errore database: ${dbErr.message}` }, { status: 500 });
  }

  console.log('[upload-photo] OK – preview: %s | hi-res: %s', photoPath, hiResPath ?? 'nessuno');

  notifyNewPhoto({ folderName: folder.name, folderSlug: folder.slug }).catch(() => null);

  return NextResponse.json({ success: true, path: photoPath });
}

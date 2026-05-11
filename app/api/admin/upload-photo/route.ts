import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';
import { randomToken } from '../../../../lib/auth';

export const runtime = 'nodejs';

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
      if (!error) return null;                      // successo
      const isTransient = /fetch failed|econnreset|timeout/i.test(error.message);
      if (!isTransient || i === attempts - 1) return error;
      console.warn(`[upload-photo] retry ${i + 1}/${attempts - 1} dopo: ${error.message}`);
    } catch (e) {
      if (i === attempts - 1) throw e;
      console.warn(`[upload-photo] retry ${i + 1}/${attempts - 1} dopo eccezione:`, e);
    }
    await sleep(600 * 2 ** i); // 600 ms, 1.2 s, 2.4 s …
  }
  return null;
}

export async function POST(request: Request) {
  // 1. Auth
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') {
    console.error('[upload-photo] 401 – token assente o non valido');
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  // 2. Parsing FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[upload-photo] FormData parse error:', msg);
    return NextResponse.json({ message: `FormData non valida: ${msg}` }, { status: 400 });
  }

  const folderId = String(formData.get('folderId') ?? '').trim();
  const caption  = String(formData.get('caption')  ?? '').trim() || null;
  const file     = formData.get('file')  as File | null;
  const hiResFile = formData.get('hiRes') as File | null;

  console.log('[upload-photo] folderId=%s file=%s size=%d', folderId, file?.name, file?.size ?? 0);

  if (!folderId || !file || file.size === 0) {
    return NextResponse.json({ message: 'folderId e file sono obbligatori.' }, { status: 400 });
  }

  // 3. Verifica cartella nel DB
  const { data: folder, error: folderErr } = await supabaseAdmin
    .from('folders')
    .select('slug')
    .eq('id', folderId)
    .single();

  if (folderErr || !folder) {
    console.error('[upload-photo] cartella non trovata:', folderErr?.message);
    return NextResponse.json({ message: 'Cartella non trovata.' }, { status: 404 });
  }

  // 4. Leggi il file
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[upload-photo] arrayBuffer error:', msg);
    return NextResponse.json({ message: `Lettura file fallita: ${msg}` }, { status: 500 });
  }

  // 5. Upload su Supabase Storage
  const base = `${Date.now()}-${randomToken(6)}`;
  const ext  = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const photoPath = `${folder.slug}/${base}.${ext}`;

  console.log('[upload-photo] upload path:', photoPath, '— size:', fileBuffer.length, 'bytes');

  let uploadError: { message: string } | null = null;
  try {
    uploadError = await uploadWithRetry(
      PHOTOS_BUCKET,
      photoPath,
      fileBuffer,
      { contentType: file.type, upsert: false }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[upload-photo] storage upload threw dopo retry:', msg);
    return NextResponse.json(
      { message: `Connessione Supabase fallita: ${msg}. Il progetto potrebbe essere in pausa.` },
      { status: 500 }
    );
  }

  if (uploadError) {
    console.error('[upload-photo] storage error definitivo:', uploadError.message);
    const low = uploadError.message.toLowerCase();
    const isBucketMissing = low.includes('bucket') || low.includes('not found') || low.includes('no such');
    return NextResponse.json(
      {
        message: isBucketMissing
          ? `Bucket "${PHOTOS_BUCKET}" non trovato. Vai su Supabase → Storage e crealo come pubblico.`
          : `Upload Supabase fallito: ${uploadError.message}`
      },
      { status: 500 }
    );
  }

  // 6. Hi-res opzionale
  let hiResPath: string | null = null;
  if (hiResFile && hiResFile.size > 0) {
    try {
      const hiExt = (hiResFile.name.split('.').pop() ?? 'jpg').toLowerCase();
      hiResPath = `${folder.slug}/${base}-hires.${hiExt}`;
      const hiBuffer = Buffer.from(await hiResFile.arrayBuffer());
      const { error: hiErr } = await supabaseAdmin.storage
        .from(HIRES_BUCKET)
        .upload(hiResPath, hiBuffer, { contentType: hiResFile.type, upsert: false });
      if (hiErr) {
        console.warn('[upload-photo] hi-res upload fallito (non bloccante):', hiErr.message);
        hiResPath = null;
      }
    } catch (e) {
      console.warn('[upload-photo] hi-res exception (non bloccante):', e);
      hiResPath = null;
    }
  }

  // 7. Registra in DB
  const { error: dbErr } = await supabaseAdmin.from('photos').insert({
    folder_id: folderId,
    storage_path: photoPath,
    caption,
    hi_res_storage_path: hiResPath
  });

  if (dbErr) {
    console.error('[upload-photo] db insert error:', dbErr.message);
    // Cleanup: rimuovi il file appena caricato per evitare orfani
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([photoPath]).catch(() => null);
    return NextResponse.json(
      { message: `Errore database: ${dbErr.message}` },
      { status: 500 }
    );
  }

  console.log('[upload-photo] OK – path:', photoPath);
  return NextResponse.json({ success: true, path: photoPath });
}

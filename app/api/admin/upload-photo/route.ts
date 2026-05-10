import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';
import { randomToken } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') {
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: 'FormData non valida.' }, { status: 400 });
  }

  const folderId = String(formData.get('folderId') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim() || null;
  const file = formData.get('file') as File | null;
  const hiResFile = formData.get('hiRes') as File | null;

  if (!folderId || !file || file.size === 0) {
    return NextResponse.json({ message: 'folderId e file sono obbligatori.' }, { status: 400 });
  }

  const { data: folder } = await supabaseAdmin
    .from('folders')
    .select('slug')
    .eq('id', folderId)
    .single();

  if (!folder) {
    return NextResponse.json({ message: 'Cartella non trovata.' }, { status: 404 });
  }

  const base = `${Date.now()}-${randomToken(6)}`;
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const photoPath = `${folder.slug}/${base}.${ext}`;

  // Upload foto principale
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(photoPath, fileBuffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    const isMissing = uploadErr.message.toLowerCase().includes('bucket') ||
      uploadErr.message.toLowerCase().includes('not found');
    return NextResponse.json(
      {
        message: isMissing
          ? 'Bucket "photos" non trovato su Supabase. Vai su Supabase → Storage e crealo come bucket pubblico.'
          : `Upload fallito: ${uploadErr.message}`
      },
      { status: 500 }
    );
  }

  // Hi-res opzionale
  let hiResPath: string | null = null;
  if (hiResFile && hiResFile.size > 0) {
    const hiExt = (hiResFile.name.split('.').pop() ?? 'jpg').toLowerCase();
    hiResPath = `${folder.slug}/${base}-hires.${hiExt}`;
    const hiBuffer = Buffer.from(await hiResFile.arrayBuffer());
    const { error: hiErr } = await supabaseAdmin.storage
      .from(HIRES_BUCKET)
      .upload(hiResPath, hiBuffer, { contentType: hiResFile.type, upsert: false });
    if (hiErr) {
      hiResPath = null;
      console.warn('[upload-photo] hi-res upload fallito:', hiErr.message);
    }
  }

  // Registra in DB
  const { error: dbErr } = await supabaseAdmin.from('photos').insert({
    folder_id: folderId,
    storage_path: photoPath,
    caption,
    hi_res_storage_path: hiResPath
  });

  if (dbErr) {
    return NextResponse.json({ message: `DB error: ${dbErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, path: photoPath });
}

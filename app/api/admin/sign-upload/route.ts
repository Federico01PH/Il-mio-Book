/**
 * Genera URL firmati per caricare preview e hi-res direttamente su Supabase
 * dal browser, bypassando il limite 4.5 MB di Vercel.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';
import { randomToken } from '../../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  folderId: z.string().uuid(),
  filename: z.string().min(1).max(260)
});

export async function POST(request: Request) {
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') {
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Dati non validi.' }, { status: 400 });
  }

  const { data: folder } = await supabaseAdmin
    .from('folders')
    .select('slug')
    .eq('id', parsed.folderId)
    .single();

  if (!folder) {
    return NextResponse.json({ message: 'Cartella non trovata.' }, { status: 404 });
  }

  const ext  = (parsed.filename.split('.').pop() ?? 'jpg').toLowerCase();
  const base = `${Date.now()}-${randomToken(6)}`;

  const previewPath = `${folder.slug}/${base}.jpg`;      // sempre JPEG compresso
  const hiResPath   = `${folder.slug}/${base}-original.${ext}`;

  // URL firmato per la preview (bucket photos, pubblico)
  const { data: previewSigned, error: previewErr } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .createSignedUploadUrl(previewPath);

  if (previewErr || !previewSigned) {
    return NextResponse.json(
      { message: `Signed URL preview fallito: ${previewErr?.message}` },
      { status: 500 }
    );
  }

  // URL firmato per l'originale (bucket hi-res, privato)
  const { data: hiResSigned, error: hiResErr } = await supabaseAdmin.storage
    .from(HIRES_BUCKET)
    .createSignedUploadUrl(hiResPath);

  if (hiResErr || !hiResSigned) {
    return NextResponse.json(
      { message: `Signed URL hi-res fallito: ${hiResErr?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    previewPath,
    previewSignedUrl: previewSigned.signedUrl,
    hiResPath,
    hiResSignedUrl: hiResSigned.signedUrl
  });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { slugify, PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';
import { randomToken } from '../../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  folderId: z.string().uuid(),
  files: z.array(
    z.object({
      name: z.string().max(200),
      type: z.string().max(100),
      isHiRes: z.boolean().optional()
    })
  ).min(1).max(50)
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

  const results: { signedUrl: string; token: string; path: string; originalName: string; isHiRes: boolean }[] = [];

  for (const file of parsed.files) {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    const base = `${Date.now()}-${randomToken(6)}`;
    const isHiRes = Boolean(file.isHiRes);
    const bucket = isHiRes ? HIRES_BUCKET : PHOTOS_BUCKET;
    const path = `${folder.slug}/${base}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { message: `Impossibile generare URL per ${file.name}: ${error?.message ?? 'errore'}` },
        { status: 500 }
      );
    }

    results.push({ signedUrl: data.signedUrl, token: data.token, path, originalName: file.name, isHiRes });
  }

  return NextResponse.json({ uploads: results });
}

/**
 * Crea il record DB dopo che il browser ha caricato preview e hi-res
 * direttamente su Supabase.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { notifyNewPhoto } from '../../../../lib/telegram';

export const runtime = 'nodejs';

const schema = z.object({
  folderId:   z.string().uuid(),
  previewPath: z.string().min(1),
  hiResPath:  z.string().min(1),
  caption:    z.string().max(500).optional().nullable()
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
    .select('name,slug')
    .eq('id', parsed.folderId)
    .single();

  if (!folder) {
    return NextResponse.json({ message: 'Cartella non trovata.' }, { status: 404 });
  }

  const { error: dbErr } = await supabaseAdmin.from('photos').insert({
    folder_id:            parsed.folderId,
    storage_path:         parsed.previewPath,
    caption:              parsed.caption ?? null,
    hi_res_storage_path:  parsed.hiResPath
  });

  if (dbErr) {
    return NextResponse.json({ message: `DB error: ${dbErr.message}` }, { status: 500 });
  }

  notifyNewPhoto({ folderName: folder.name, folderSlug: folder.slug }).catch(() => null);

  return NextResponse.json({ success: true });
}

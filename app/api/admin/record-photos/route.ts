import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

const schema = z.object({
  photos: z.array(
    z.object({
      folderId: z.string().uuid(),
      path: z.string().min(1).max(400),
      caption: z.string().max(280).optional(),
      hiResPath: z.string().max(400).optional()
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

  const rows = parsed.photos.map((p) => ({
    folder_id: p.folderId,
    storage_path: p.path,
    caption: p.caption ?? null,
    hi_res_storage_path: p.hiResPath ?? null
  }));

  const { error } = await supabaseAdmin.from('photos').insert(rows);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const folderIds = [...new Set(parsed.photos.map((p) => p.folderId))];
  const { data: folders } = await supabaseAdmin
    .from('folders')
    .select('slug')
    .in('id', folderIds);

  revalidatePath('/admin');
  revalidatePath('/galleries');
  for (const f of folders ?? []) {
    revalidatePath(`/galleries/${f.slug}`);
  }

  return NextResponse.json({ success: true, count: rows.length });
}

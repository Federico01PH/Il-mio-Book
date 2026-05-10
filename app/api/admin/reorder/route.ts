import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

const schema = z.object({
  type: z.enum(['folder', 'photo']),
  orderedIds: z.array(z.string().uuid()).min(1).max(200)
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

  const table = parsed.type === 'folder' ? 'folders' : 'photos';

  // Aggiorna sort_order in parallelo
  await Promise.all(
    parsed.orderedIds.map((id, index) =>
      supabaseAdmin.from(table).update({ sort_order: index }).eq('id', id)
    )
  );

  revalidatePath('/admin');
  revalidatePath('/galleries');

  return NextResponse.json({ success: true });
}

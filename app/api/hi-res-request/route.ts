import { NextResponse } from 'next/server';
import { z } from 'zod';
import supabaseAdmin from '../../../lib/supabaseServer';
import { sendHiResNotificationToAdmin } from '../../../lib/mailer';
import { getActiveSession } from '../../../lib/session';

export const runtime = 'nodejs';

const schema = z.object({
  photoId: z.string().uuid(),
  message: z.string().trim().max(2000).optional()
});

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session) {
    return NextResponse.json({ message: 'Sessione non valida.' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message : 'Dati non validi';
    return NextResponse.json({ message }, { status: 400 });
  }

  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('id,caption,folder:folder_id(name)')
    .eq('id', parsed.photoId)
    .single();

  if (!photo) {
    return NextResponse.json({ message: 'Foto non trovata.' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('hi_res_requests').insert({
    photo_id: parsed.photoId,
    email: session.email,
    message: parsed.message ?? null,
    status: 'pending'
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  try {
    const folderName = Array.isArray(photo.folder)
      ? (photo.folder[0] as { name?: string } | undefined)?.name ?? null
      : ((photo.folder as { name?: string } | null)?.name ?? null);
    await sendHiResNotificationToAdmin({
      email: session.email,
      photoCaption: photo.caption ?? null,
      folderName,
      message: parsed.message ?? null
    });
  } catch (sendError) {
    console.error('[hi-res] invio email admin fallito:', sendError);
  }

  return NextResponse.json({ success: true });
}

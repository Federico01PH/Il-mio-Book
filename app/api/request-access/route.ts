import { NextResponse } from 'next/server';
import { z } from 'zod';
import supabaseAdmin from '../../../lib/supabaseServer';
import { sendAccessRequestNotification } from '../../../lib/mailer';
import { randomToken } from '../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().email('Email non valida').max(180),
  reason: z.string().trim().min(10, 'Motivazione troppo corta').max(2000)
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.errors[0]?.message : 'Dati non validi';
    return NextResponse.json({ message }, { status: 400 });
  }

  const requestToken = randomToken();

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .insert({
      email: parsed.email,
      reason: parsed.reason,
      request_token: requestToken,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'Errore di salvataggio' }, { status: 500 });
  }

  try {
    await sendAccessRequestNotification(data.id, parsed.email, parsed.reason);
  } catch (sendError) {
    console.error('[request-access] invio email admin fallito:', sendError);
  }

  return NextResponse.json({ success: true });
}

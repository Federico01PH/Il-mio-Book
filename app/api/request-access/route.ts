import { NextResponse } from 'next/server';
import { z } from 'zod';
import supabaseAdmin from '../../../lib/supabaseServer';
import { sendAccessRequestNotification } from '../../../lib/mailer';
import { notifyNewAccessRequest } from '../../../lib/telegram';
import { randomToken } from '../../../lib/auth';
import { SESSION_COOKIE } from '../../../lib/session';

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

  const ip =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null;

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .insert({
      email: parsed.email,
      reason: parsed.reason,
      request_token: requestToken,
      ip_address: ip,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message ?? 'Errore di salvataggio' }, { status: 500 });
  }

  // Notifica admin via email e Telegram (l'utente NON riceve nulla)
  await Promise.allSettled([
    sendAccessRequestNotification(data.id, parsed.email, parsed.reason).catch((e) =>
      console.error('[request-access] email admin fallita:', e)
    ),
    notifyNewAccessRequest({ requestId: data.id, email: parsed.email, reason: parsed.reason }).catch(
      (e) => console.error('[request-access] telegram fallito:', e)
    )
  ]);

  // Cookie con il token: l'utente sarà sbloccato automaticamente quando lo status diventa approved
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: requestToken,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 60, // 60 giorni
    secure: process.env.NODE_ENV === 'production'
  });
  return response;
}

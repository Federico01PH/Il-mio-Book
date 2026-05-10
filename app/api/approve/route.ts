import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/supabaseServer';
import { sendMagicLinkEmail } from '../../../lib/mailer';
import { randomToken, verify } from '../../../lib/auth';
import { env } from '../../../lib/env';

export const runtime = 'nodejs';

const SESSION_TTL_DAYS = 30;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  const payload = verify(token);

  if (!payload || payload.act !== 'approve') {
    return responsePage('Link non valido o scaduto.');
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('access_requests')
    .select('id,email,status')
    .eq('id', payload.sub)
    .single();

  if (fetchError || !existing) {
    return responsePage('Richiesta non trovata.');
  }

  if (existing.status === 'approved') {
    return responsePage('Richiesta già approvata.');
  }
  if (existing.status === 'rejected') {
    return responsePage('Richiesta già rifiutata.');
  }

  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'approved',
      session_token: sessionToken,
      session_expires_at: expiresAt.toISOString(),
      consumed_at: new Date().toISOString()
    })
    .eq('id', existing.id);

  if (updateError) {
    return responsePage(`Errore: ${updateError.message}`);
  }

  const accessLink = `${env.siteUrl}/api/access?token=${encodeURIComponent(sessionToken)}`;

  try {
    await sendMagicLinkEmail(existing.email, accessLink);
  } catch (sendError) {
    console.error('[approve] invio magic link fallito:', sendError);
  }

  return responsePage(`Approvazione registrata. Email inviata a ${existing.email}.`);
}

function responsePage(message: string) {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"/><title>Esito</title>
  <style>body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
  .card{max-width:420px;text-align:center;border:1px solid #222;background:#111;padding:32px;border-radius:18px;}</style></head>
  <body><div class="card"><p style="letter-spacing:.32em;text-transform:uppercase;color:#888;font-size:11px;margin:0 0 8px;">Portfolio</p>
  <p style="margin:0;color:#fff;font-size:16px;line-height:1.6;">${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

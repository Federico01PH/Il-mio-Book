import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/supabaseServer';
import { SESSION_COOKIE } from '../../../lib/session';
import { env } from '../../../lib/env';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return errorPage('Token mancante.');

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .select('id,status,session_expires_at')
    .eq('session_token', token)
    .single();

  if (error || !data) return errorPage('Link non valido.');
  if (data.status !== 'approved') return errorPage('Accesso non approvato.');
  if (data.session_expires_at && new Date(data.session_expires_at).getTime() < Date.now()) {
    return errorPage('Link scaduto.');
  }

  const homeUrl = new URL('/', env.siteUrl).toString();
  const response = NextResponse.redirect(homeUrl);
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return response;
}

function errorPage(message: string) {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"/><title>Errore</title>
  <style>body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
  .card{max-width:420px;text-align:center;border:1px solid #222;background:#111;padding:32px;border-radius:18px;}
  a{color:#fff;text-decoration:underline;}</style></head>
  <body><div class="card"><p style="letter-spacing:.32em;text-transform:uppercase;color:#888;font-size:11px;margin:0 0 8px;">Portfolio</p>
  <p style="margin:0 0 16px;color:#fff;">${message}</p>
  <a href="/">Torna al gate</a></div></body></html>`;
  return new NextResponse(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

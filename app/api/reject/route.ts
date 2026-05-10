import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/supabaseServer';
import { verify } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  const payload = verify(token);

  if (!payload || payload.act !== 'reject') {
    return page('Link non valido o scaduto.');
  }

  const { data: existing } = await supabaseAdmin
    .from('access_requests')
    .select('id,status')
    .eq('id', payload.sub)
    .single();

  if (!existing) return page('Richiesta non trovata.');

  if (existing.status !== 'pending') {
    return page('Richiesta già processata.');
  }

  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'rejected', consumed_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (error) return page(`Errore: ${error.message}`);

  return page('Richiesta rifiutata.');
}

function page(message: string) {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"/><title>Esito</title>
  <style>body{margin:0;background:#0a0a0a;color:#e5e5e5;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
  .card{max-width:420px;text-align:center;border:1px solid #222;background:#111;padding:32px;border-radius:18px;}</style></head>
  <body><div class="card"><p style="letter-spacing:.32em;text-transform:uppercase;color:#888;font-size:11px;margin:0 0 8px;">Portfolio</p>
  <p style="margin:0;color:#fff;font-size:16px;line-height:1.6;">${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

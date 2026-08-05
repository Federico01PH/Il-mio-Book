/**
 * Keep-alive: chiamato ogni giorno dal cron di Vercel (vedi vercel.json).
 * Fa una query banale su Supabase così il progetto free risulta "attivo"
 * e non viene messo in pausa per inattività (che spegnerebbe tutto il sito).
 * Non espone dati e non modifica nulla.
 */
import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await supabaseAdmin
    .from('site_settings')
    .select('key')
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Manutenzione giornaliera: cancella le visite piu vecchie di 30 giorni,
  // cosi la sezione "Visite recenti" resta pulita e la tabella non si riempie.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('visits').delete().lt('visited_at', cutoff);

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

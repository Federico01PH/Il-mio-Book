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

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

/**
 * Avvia il reset password admin: genera un token monouso e invia l'email
 * con il link SOLO all'indirizzo admin configurato. Risponde sempre "success"
 * per non rivelare dettagli.
 */
import { NextResponse } from 'next/server';
import { createResetToken } from '../../../../lib/adminAuth';
import { sendAdminPasswordReset } from '../../../../lib/mailer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const token = await createResetToken();
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = request.headers.get('host') ?? '';
    const base = host ? `${proto}://${host}` : '';
    const resetUrl = `${base}/admin/reset?token=${encodeURIComponent(token)}`;
    await sendAdminPasswordReset(resetUrl);
  } catch (e) {
    console.error('[admin/forgot] invio reset fallito:', e);
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') {
    return NextResponse.json({ message: 'Non autorizzato. Fai login su /admin/login prima.' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json({
      ok: false,
      error: 'Variabili mancanti',
      TELEGRAM_BOT_TOKEN: token ? '✓ presente' : '✗ MANCANTE',
      TELEGRAM_CHAT_ID: chatId ? '✓ presente' : '✗ MANCANTE'
    });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '✅ Connessione Telegram funzionante! Le notifiche del portfolio sono attive.',
      parse_mode: 'HTML'
    })
  });

  const body = await res.json();

  return NextResponse.json({
    ok: res.ok,
    telegram_response: body,
    TELEGRAM_BOT_TOKEN: '✓ presente',
    TELEGRAM_CHAT_ID: chatId
  });
}

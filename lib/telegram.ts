import { env } from './env';
import { sign, nowSec } from './auth';

function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function sendMessage(payload: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...payload })
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn('[telegram] sendMessage fallito:', res.status, body);
  }
}

export async function notifyNewAccessRequest(params: {
  requestId: string;
  email: string;
  reason: string;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  const ttlHours = 72;
  const exp = nowSec() + ttlHours * 60 * 60;
  const approveToken = sign({ sub: params.requestId, act: 'approve', exp });
  const rejectToken = sign({ sub: params.requestId, act: 'reject', exp });

  const approveUrl = `${env.siteUrl}/api/approve?t=${encodeURIComponent(approveToken)}`;
  const rejectUrl = `${env.siteUrl}/api/reject?t=${encodeURIComponent(rejectToken)}`;

  const reasonPreview = params.reason.length > 200
    ? params.reason.slice(0, 200) + '…'
    : params.reason;

  await sendMessage({
    text: `📸 <b>Nuova richiesta di accesso</b>\n\n<b>Email:</b> ${escapeHtml(params.email)}\n<b>Motivazione:</b>\n${escapeHtml(reasonPreview)}`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Approva', url: approveUrl },
        { text: '❌ Rifiuta', url: rejectUrl }
      ]]
    }
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

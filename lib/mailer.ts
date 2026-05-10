import { env, isMailerConfigured } from './env';
import { sign, nowSec } from './auth';

async function sendEmail(to: string, subject: string, html: string) {
  if (!isMailerConfigured()) {
    console.warn(`[mailer] non configurato — email "${subject}" verso ${to} saltata.`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.mailerApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.mailerFrom,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Invio email fallito: ${response.status} ${body}`);
  }
}

function layout(title: string, body: string): string {
  return `
<!doctype html>
<html lang="it">
  <body style="margin:0;background:#0a0a0a;padding:32px;font-family:Inter,system-ui,sans-serif;color:#e5e5e5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:#111;border:1px solid #222;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:32px 32px 12px 32px;">
        <p style="margin:0;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#888;">${env.siteName}</p>
        <h1 style="margin:8px 0 0 0;font-size:22px;color:#fff;">${title}</h1>
      </td></tr>
      <tr><td style="padding:16px 32px 32px 32px;font-size:14px;line-height:1.6;color:#cfcfcf;">${body}</td></tr>
    </table>
  </body>
</html>`;
}

export async function sendAccessRequestNotification(
  requestId: string,
  email: string,
  reason: string
) {
  const ttlHours = 72;
  const exp = nowSec() + ttlHours * 60 * 60;
  const approveToken = sign({ sub: requestId, act: 'approve', exp });
  const rejectToken = sign({ sub: requestId, act: 'reject', exp });

  const approveUrl = `${env.siteUrl}/api/approve?t=${encodeURIComponent(approveToken)}`;
  const rejectUrl = `${env.siteUrl}/api/reject?t=${encodeURIComponent(rejectToken)}`;

  const html = layout(
    'Nuova richiesta di accesso',
    `
      <p><strong style="color:#fff;">Email:</strong> ${escapeHtml(email)}</p>
      <p><strong style="color:#fff;">Motivazione:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(reason)}</p>
      <p style="margin-top:24px;">
        <a href="${approveUrl}" style="display:inline-block;margin:6px 12px 6px 0;padding:12px 22px;background:#fff;color:#000;text-decoration:none;border-radius:999px;font-weight:600;">Approva</a>
        <a href="${rejectUrl}" style="display:inline-block;margin:6px 0;padding:12px 22px;background:#222;color:#fff;text-decoration:none;border-radius:999px;border:1px solid #333;">Rifiuta</a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:24px;">I link scadono fra ${ttlHours} ore.</p>
    `
  );

  await sendEmail(env.adminEmail, `Richiesta accesso · ${email}`, html);
}

export async function sendMagicLinkEmail(email: string, accessLink: string) {
  const html = layout(
    'Accesso approvato',
    `
      <p>La tua richiesta è stata approvata. Clicca il pulsante qui sotto per entrare nel portfolio.</p>
      <p style="margin:24px 0;">
        <a href="${accessLink}" style="display:inline-block;padding:14px 24px;background:#fff;color:#000;text-decoration:none;border-radius:999px;font-weight:600;">Entra nel portfolio</a>
      </p>
      <p style="font-size:12px;color:#888;">Il link rimane valido per 30 giorni e può essere usato una sola volta da questo dispositivo.</p>
    `
  );

  await sendEmail(email, `${env.siteName} · Accesso approvato`, html);
}

export async function sendHiResNotificationToAdmin(params: {
  email: string;
  photoCaption: string | null;
  folderName: string | null;
  message: string | null;
}) {
  const html = layout(
    'Nuova richiesta alta risoluzione',
    `
      <p><strong style="color:#fff;">Da:</strong> ${escapeHtml(params.email)}</p>
      ${params.folderName ? `<p><strong style="color:#fff;">Cartella:</strong> ${escapeHtml(params.folderName)}</p>` : ''}
      ${params.photoCaption ? `<p><strong style="color:#fff;">Foto:</strong> ${escapeHtml(params.photoCaption)}</p>` : ''}
      ${params.message ? `<p><strong style="color:#fff;">Messaggio:</strong></p><p style="white-space:pre-wrap;">${escapeHtml(params.message)}</p>` : ''}
      <p style="font-size:12px;color:#888;margin-top:24px;">Gestisci la richiesta dalla dashboard admin.</p>
    `
  );

  await sendEmail(env.adminEmail, `Hi-res · ${params.email}`, html);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

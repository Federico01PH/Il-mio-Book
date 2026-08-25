import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sign, nowSec } from '../../../../lib/auth';
import { verifyAdminPassword } from '../../../../lib/adminAuth';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

// Durata sessione admin: 1 anno. Una volta entrato, il sito non richiede
// piu' la password su quel browser per lungo tempo.
const SESSION_SECONDS = 60 * 60 * 24 * 365;

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Dati non validi.' }, { status: 400 });
  }

  if (!(await verifyAdminPassword(parsed.password))) {
    return NextResponse.json({ message: 'Password errata.' }, { status: 401 });
  }

  const exp = nowSec() + SESSION_SECONDS;
  const token = sign({ sub: 'admin', act: 'admin-session', exp });

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
    secure: process.env.NODE_ENV === 'production'
  });
  return response;
}

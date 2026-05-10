import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminPassword, sign, nowSec } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Dati non validi.' }, { status: 400 });
  }

  if (!isAdminPassword(parsed.password)) {
    return NextResponse.json({ message: 'Password errata.' }, { status: 401 });
  }

  const exp = nowSec() + 60 * 60 * 24 * 7;
  const token = sign({ sub: 'admin', act: 'admin-session', exp });

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production'
  });
  return response;
}

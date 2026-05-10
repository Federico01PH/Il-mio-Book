import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}

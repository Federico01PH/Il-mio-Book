import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../lib/session';
import supabaseAdmin from '../../../lib/supabaseServer';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await supabaseAdmin
      .from('access_requests')
      .update({ session_token: null, session_expires_at: null })
      .eq('session_token', token);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

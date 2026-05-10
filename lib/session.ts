import { cookies } from 'next/headers';
import supabaseAdmin from './supabaseServer';

export const SESSION_COOKIE = 'session_token';
export const ADMIN_COOKIE = 'admin_session';

export interface ActiveSession {
  email: string;
  requestId: string;
}

/**
 * Verifica il cookie di sessione contro il DB.
 * Restituisce null se assente, scaduto o non approvato.
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .select('id,email,status,session_expires_at')
    .eq('session_token', token)
    .single();

  if (error || !data) return null;
  if (data.status !== 'approved') return null;
  if (data.session_expires_at && new Date(data.session_expires_at).getTime() < Date.now()) {
    return null;
  }

  return { email: data.email, requestId: data.id };
}

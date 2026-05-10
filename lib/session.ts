import { cookies } from 'next/headers';
import supabaseAdmin from './supabaseServer';

export const SESSION_COOKIE = 'session_token';
export const ADMIN_COOKIE = 'admin_session';

export interface ActiveSession {
  email: string;
  requestId: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Sessione attiva = cookie presente + richiesta approvata + non scaduta.
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .select('id,email,status,session_expires_at')
    .eq('request_token', token)
    .single();

  if (error || !data) return null;
  if (data.status !== 'approved') return null;
  if (data.session_expires_at && new Date(data.session_expires_at).getTime() < Date.now()) {
    return null;
  }

  return { email: data.email, requestId: data.id };
}

/**
 * Status corrente della richiesta legata al cookie.
 * Restituisce null se non c'è cookie, o la richiesta non esiste.
 */
export async function getRequestStatus(): Promise<RequestStatus | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data } = await supabaseAdmin
    .from('access_requests')
    .select('status,session_expires_at')
    .eq('request_token', token)
    .single();

  if (!data) return null;

  if (
    data.status === 'approved' &&
    data.session_expires_at &&
    new Date(data.session_expires_at).getTime() < Date.now()
  ) {
    return null;
  }
  return data.status as RequestStatus;
}

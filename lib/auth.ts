import crypto from 'node:crypto';
import { env } from './env';

const ENCODER = 'base64url';

function base64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString(ENCODER);
}

function fromBase64urlJson<T = unknown>(str: string): T {
  return JSON.parse(Buffer.from(str, ENCODER).toString('utf8')) as T;
}

function hmac(input: string): string {
  return crypto.createHmac('sha256', env.adminSecret).update(input).digest(ENCODER);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export interface SignedPayload {
  /** Subject (es. id richiesta, "admin") */
  sub: string;
  /** Action (es. "approve", "reject", "admin-session") */
  act: string;
  /** Expiration timestamp (epoch seconds). 0 = nessuna scadenza */
  exp: number;
}

export function sign(payload: SignedPayload): string {
  const body = base64urlJson(payload);
  const sig = hmac(body);
  return `${body}.${sig}`;
}

export function verify(token: string | null | undefined): SignedPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expectedSig = hmac(body);
  if (!timingSafeEqual(sig, expectedSig)) return null;

  let payload: SignedPayload;
  try {
    payload = fromBase64urlJson<SignedPayload>(body);
  } catch {
    return null;
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString(ENCODER);
}

/** Confronto in tempo costante per password admin */
export function isAdminPassword(input: string): boolean {
  if (!input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(env.adminSecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

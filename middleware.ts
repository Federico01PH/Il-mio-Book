import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, ADMIN_COOKIE } from './lib/session';

const PROTECTED_PREFIXES: string[] = []; // gallerie e bio ora pubbliche
const ADMIN_PREFIX = '/admin';
// Pagine admin raggiungibili SENZA essere gia' loggati (login e reset password).
const ADMIN_PUBLIC = ['/admin/login', '/admin/reset'];

/**
 * Middleware "leggero": controlla solo presenza dei cookie.
 * La validazione vera (verifica HMAC + DB) avviene nei layout server,
 * perché il middleware Edge non può chiamare Supabase con service role.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (ADMIN_PUBLIC.includes(pathname)) return NextResponse.next();
    const adminCookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!adminCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/galleries/:path*', '/bio/:path*', '/admin/:path*']
};

// HomeOps — request shaping: security headers, CSP nonce, correlation id (T-PLAT-026, T-PLAT-027).
//
// Next.js 16 renamed `middleware.ts` to `proxy.ts` (ADR-001). This layer makes **no** authorization
// decisions (ADR-001, MODULE-MAP.md §1): it shapes the request and the response headers. Sessions,
// roles, and household scope are resolved in `src/server/auth/*` and enforced in feature actions.

import { NextResponse, type NextRequest } from 'next/server';
import { REQUEST_ID_HEADER, isRequestIdShape, newRequestId } from './shared/contracts/request-id';

/**
 * CSP without `unsafe-inline`: the per-request nonce is forwarded on the *request* headers, which is
 * how Next.js attaches it to the scripts and styles it injects (SECURITY.md §7).
 */
function contentSecurityPolicy(nonce: string, isHttps: boolean): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];
  // Only upgrade when the deployment really terminates TLS (T-PLAT-026: HSTS after HTTPS verified).
  if (isHttps) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  // A client-supplied correlation id is never trusted: it is replaced, not merged (T-PLAT-027).
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  const requestId = isRequestIdShape(incoming) ? incoming : newRequestId();
  const nonce = newRequestId();

  const isHttps =
    request.nextUrl.protocol === 'https:' || (process.env.APP_URL?.startsWith('https://') ?? false);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set('content-security-policy', contentSecurityPolicy(nonce, isHttps));

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce, isHttps));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // A household app has no use for these device capabilities (PRIVACY.md §1, THREAT_MODEL T-11).
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set(REQUEST_ID_HEADER, requestId);

  if (isHttps) {
    // Two years, includeSubDomains, preload-ready; added only once TLS is verified (SECURITY.md §7).
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  const path = request.nextUrl.pathname;
  const isStaticAsset =
    path.startsWith('/_next/static') ||
    path.startsWith('/icons') ||
    path.endsWith('.png') ||
    path.endsWith('.svg');
  if (!isStaticAsset) {
    // Authenticated HTML is never cached by a shared proxy (SECURITY.md §7, ADR-014 network-first data).
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return response;
}

export const config = {
  // Skip Next's own static output and the service worker; everything else is shaped here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)'],
};

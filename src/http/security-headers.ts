/**
 * Security headers for every HTTP response. The Content-Security-Policy is
 * strict for scripts (self plus an optional hash for a page's inline script),
 * allows Google Fonts stylesheets and fonts used by the preview, and allows
 * inline style attributes that the interface sets for widths and CSS variables.
 */
export interface CspOptions {
  /** SHA-256 (base64) hashes of inline scripts permitted on this response. */
  inlineScriptHashes?: readonly string[];
}

export function contentSecurityPolicy(options: CspOptions = {}): string {
  const scriptSources = ["'self'", ...(options.inlineScriptHashes ?? []).map((hash) => `'sha256-${hash}'`)];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function securityHeaders(options: CspOptions = {}): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  };
}

/** Base64 of raw SHA-256 bytes, as required by CSP hash sources. */
export async function cspScriptHash(script: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(script));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Extracts inline script bodies from an HTML document (no src attribute). */
export function inlineScripts(html: string): readonly string[] {
  const bodies: string[] = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) bodies.push(match[1] ?? '');
  return bodies;
}

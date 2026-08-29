/**
 * Impostazioni dello slideshow di sfondo della home, salvate in site_settings:
 *  - home_slides:         JSON array di storage_path scelti dall'admin
 *  - home_slide_seconds:  secondi tra una foto e l'altra
 */

export const DEFAULT_SLIDE_SECONDS = 7;
export const MIN_SLIDE_SECONDS = 2;
export const MAX_SLIDE_SECONDS = 30;

/** Foto scelte a mano dall'admin. Array vuoto = scelta automatica. */
export function parseSelectedSlides(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === 'string' && p.length > 0);
  } catch {
    return [];
  }
}

/** Secondi tra una foto e l'altra, riportati sempre dentro i limiti ammessi. */
export function parseSlideSeconds(value: string | number | null | undefined): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return DEFAULT_SLIDE_SECONDS;
  return Math.min(MAX_SLIDE_SECONDS, Math.max(MIN_SLIDE_SECONDS, Math.round(seconds)));
}

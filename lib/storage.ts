import supabaseAdmin from './supabaseServer';

export const PHOTOS_BUCKET = 'photos';
export const HIRES_BUCKET = 'hi-res';

/** URL pubblico di un oggetto nel bucket "photos". */
export function publicPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** URL firmato a scadenza per il bucket "hi-res" privato. */
export async function signedHiResUrl(path: string, expiresInSeconds = 60 * 60 * 24 * 3) {
  const { data, error } = await supabaseAdmin.storage
    .from(HIRES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

/** Slug-ifica un nome di file/cartella. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

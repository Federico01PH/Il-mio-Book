import InternalHome from '../components/InternalHome';
import supabaseAdmin from '../lib/supabaseServer';
import { publicPhotoUrl, PHOTOS_BUCKET } from '../lib/storage';
import {
  parseSelectedSlides,
  parseSlideSeconds,
  backgroundStoragePath,
  BACKGROUND_PREFIX
} from '../lib/homeSlides';

export const dynamic = 'force-dynamic';

/** Quante foto al massimo ruotano nello sfondo della home. */
const HERO_MAX_SLIDES = 10;

export default async function Page() {
  const [{ data: folders }, { data: settingsRows }, { data: readyBackgrounds }] =
    await Promise.all([
      supabaseAdmin
        .from('folders')
        .select('cover_storage_path')
        .order('sort_order', { ascending: true })
        .limit(6),
      supabaseAdmin.from('site_settings').select('key,value'),
      supabaseAdmin.storage.from(PHOTOS_BUCKET).list(BACKGROUND_PREFIX, { limit: 1000 })
    ]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value ?? '';
  }

  const chosenPaths = parseSelectedSlides(settings.home_slides);
  const photosQuery = supabaseAdmin
    .from('photos')
    .select('id,folder_id,storage_path,hi_res_storage_path');

  const { data: photos } =
    chosenPaths.length > 0
      ? await photosQuery.in('storage_path', chosenPaths)
      : await photosQuery
          // created_at come secondo criterio: senza, le foto con lo stesso
          // sort_order escono in ordine casuale e lo sfondo cambia a ogni visita.
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(60);

  const photoByPath = new Map((photos ?? []).map((p) => [p.storage_path, p]));

  // Sfondi gia' generati dall'originale: li servo direttamente da Supabase.
  const readyIds = new Set(
    (readyBackgrounds ?? []).map((file) => file.name.replace(/\.jpg$/, ''))
  );

  /**
   * Le anteprime pubbliche sono a 1200 px: a tutto schermo si vedono sgranate.
   * Dove esiste l'originale uso la versione grande, generandola al primo giro.
   */
  function backgroundUrl(storagePath: string): string | null {
    const photo = photoByPath.get(storagePath);
    if (!photo?.hi_res_storage_path) return publicPhotoUrl(storagePath);
    return readyIds.has(photo.id)
      ? publicPhotoUrl(backgroundStoragePath(photo.id))
      : `/api/home-bg/${photo.id}`;
  }

  const coverPaths = (folders ?? [])
    .map((f) => f.cover_storage_path)
    .filter((p): p is string => Boolean(p));

  // Raggruppo le foto per galleria e le alterno, cosi' lo sfondo non mostra
  // tutta una galleria di fila prima di passare alla successiva.
  const byFolder = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const list = byFolder.get(photo.folder_id) ?? [];
    list.push(photo.storage_path);
    byFolder.set(photo.folder_id, list);
  }

  const lists = [...byFolder.values()];
  const interleaved: string[] = [];
  for (let i = 0; lists.some((list) => i < list.length); i++) {
    for (const list of lists) {
      if (list[i]) interleaved.push(list[i]);
    }
  }

  // Prima le copertine (sono le foto scelte come vetrina), poi le altre.
  const automaticPaths = [...new Set([...coverPaths, ...interleaved])].slice(0, HERO_MAX_SLIDES);

  // Se dall'admin sono state scelte delle foto, comandano quelle.
  const slides = (chosenPaths.length > 0 ? chosenPaths : automaticPaths)
    .map((path) => backgroundUrl(path))
    .filter((u): u is string => Boolean(u));

  const slideSeconds = parseSlideSeconds(settings.home_slide_seconds);

  const bio = {
    name: settings.bio_name || 'Federico Azzarito',
    title: settings.bio_title || 'Fotografo',
    text: settings.bio_text || '',
    avatarUrl: publicPhotoUrl(settings.bio_avatar_path || null),
    whatsapp: settings.whatsapp_url || '',
    telegram: settings.telegram_url || '',
    instagram: settings.instagram_url || ''
  };

  return (
    <main className="bg-surface text-text">
      <InternalHome slides={slides} bio={bio} intervalMs={slideSeconds * 1000} />
    </main>
  );
}

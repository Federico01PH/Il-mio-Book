import InternalHome from '../components/InternalHome';
import supabaseAdmin from '../lib/supabaseServer';
import { publicPhotoUrl } from '../lib/storage';

export const dynamic = 'force-dynamic';

/** Quante foto al massimo ruotano nello sfondo della home. */
const HERO_MAX_SLIDES = 10;

export default async function Page() {
  const [{ data: folders }, { data: photos }, { data: settingsRows }] = await Promise.all([
    supabaseAdmin
      .from('folders')
      .select('cover_storage_path')
      .order('sort_order', { ascending: true })
      .limit(6),
    supabaseAdmin
      .from('photos')
      .select('folder_id,storage_path')
      .order('sort_order', { ascending: true })
      .limit(60),
    supabaseAdmin.from('site_settings').select('key,value')
  ]);

  const covers = (folders ?? [])
    .map((f) => publicPhotoUrl(f.cover_storage_path))
    .filter((u): u is string => Boolean(u));

  // Raggruppo le foto per galleria e le alterno, cosi' lo sfondo non mostra
  // tutta una galleria di fila prima di passare alla successiva.
  const byFolder = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const url = publicPhotoUrl(photo.storage_path);
    if (!url) continue;
    const list = byFolder.get(photo.folder_id) ?? [];
    list.push(url);
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
  const slides = [...new Set([...covers, ...interleaved])].slice(0, HERO_MAX_SLIDES);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value ?? '';
  }

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
      <InternalHome slides={slides} bio={bio} />
    </main>
  );
}

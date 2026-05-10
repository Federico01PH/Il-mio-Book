import AccessGate from '../components/AccessGate';
import PendingGate from '../components/PendingGate';
import InternalHome from '../components/InternalHome';
import { getActiveSession, getRequestStatus } from '../lib/session';
import supabaseAdmin from '../lib/supabaseServer';
import { publicPhotoUrl } from '../lib/storage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getActiveSession();

  if (!session) {
    const status = await getRequestStatus();
    return (
      <main className="min-h-screen bg-surface text-text">
        {status === 'pending' ? (
          <PendingGate />
        ) : status === 'rejected' ? (
          <PendingGate rejected />
        ) : (
          <AccessGate />
        )}
      </main>
    );
  }

  const [{ data: folders }, { data: settingsRows }] = await Promise.all([
    supabaseAdmin
      .from('folders')
      .select('cover_storage_path')
      .order('sort_order', { ascending: true })
      .limit(6),
    supabaseAdmin.from('site_settings').select('key,value')
  ]);

  const slides = (folders ?? [])
    .map((f) => publicPhotoUrl(f.cover_storage_path))
    .filter((u): u is string => Boolean(u));

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

import AccessGate from '../components/AccessGate';
import InternalHome from '../components/InternalHome';
import { getActiveSession } from '../lib/session';
import supabaseAdmin from '../lib/supabaseServer';
import { publicPhotoUrl } from '../lib/storage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getActiveSession();

  if (!session) {
    return (
      <main className="min-h-screen bg-surface text-text">
        <AccessGate />
      </main>
    );
  }

  const { data: folders } = await supabaseAdmin
    .from('folders')
    .select('cover_storage_path')
    .order('sort_order', { ascending: true })
    .limit(6);

  const slides = (folders ?? [])
    .map((f) => publicPhotoUrl(f.cover_storage_path))
    .filter((u): u is string => Boolean(u));

  return (
    <main className="min-h-screen bg-surface text-text">
      <InternalHome slides={slides} />
    </main>
  );
}

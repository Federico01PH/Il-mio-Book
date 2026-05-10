import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import supabaseAdmin from '../../lib/supabaseServer';
import { verify } from '../../lib/auth';
import { ADMIN_COOKIE } from '../../lib/session';
import { publicPhotoUrl } from '../../lib/storage';
import {
  approveRequest,
  rejectRequest,
  markHiResSent,
  revokeAccess,
  createFolder,
  deleteFolder,
  deletePhoto,
  updateSettings,
  adminLogout
} from './actions';
import PhotoUploader from './PhotoUploader';
import SubmitButton from './SubmitButton';
import SaveBanner from './SaveBanner';
import DraggableList from './DraggableList';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

interface SettingsMap {
  site_name?: string;
  bio_name?: string;
  bio_title?: string;
  bio_text?: string;
  bio_avatar_path?: string;
  whatsapp_url?: string;
  telegram_url?: string;
  instagram_url?: string;
}

export default async function AdminPage({
  searchParams
}: {
  searchParams: { saved?: string };
}) {
  const cookie = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(cookie);
  if (!payload || payload.act !== 'admin-session') redirect('/admin/login');

  const [reqs, approved, hiRes, folders, photos, settingsRows] = await Promise.all([
    supabaseAdmin
      .from('access_requests')
      .select('id,email,reason,status,created_at')
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('access_requests')
      .select('id,email,ip_address,created_at,consumed_at,session_expires_at')
      .eq('status', 'approved')
      .order('consumed_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('hi_res_requests')
      .select('id,email,message,status,created_at,photo:photo_id(caption,folder:folder_id(name,slug))')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('folders')
      .select('id,name,slug,description,cover_storage_path,sort_order')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('photos')
      .select('id,folder_id,storage_path,caption,hi_res_storage_path')
      .order('sort_order', { ascending: true }),
    supabaseAdmin.from('site_settings').select('key,value')
  ]);

  const settings: SettingsMap = {};
  for (const row of settingsRows.data ?? []) {
    (settings as Record<string, string>)[row.key] = row.value ?? '';
  }

  const photosByFolder = new Map<string, typeof photos.data>();
  for (const p of photos.data ?? []) {
    const list = photosByFolder.get(p.folder_id) ?? [];
    list.push(p);
    photosByFolder.set(p.folder_id, list);
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-12 text-text">
      <SaveBanner saved={searchParams.saved} />
      <section className="container mx-auto max-w-6xl space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Dashboard</p>
            <h1 className="text-3xl font-semibold">Admin</h1>
          </div>
          <form action={adminLogout}>
            <button className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/80 hover:bg-white/5">
              Esci
            </button>
          </form>
        </header>

        {/* CHI HA ACCESSO */}
        <Section title={`Chi ha accesso (${(approved.data ?? []).length})`}>
          {(approved.data ?? []).length === 0 ? (
            <Empty>Nessun utente approvato.</Empty>
          ) : (
            <ul className="space-y-2">
              {approved.data!.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/60 px-5 py-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{r.email}</p>
                    <p className="text-xs text-muted">
                      IP: {r.ip_address ?? '—'} · Richiesta:{' '}
                      {new Date(r.created_at).toLocaleDateString('it-IT')} · Approvato:{' '}
                      {r.consumed_at
                        ? new Date(r.consumed_at).toLocaleDateString('it-IT')
                        : '—'} ·{' '}
                      {r.session_expires_at
                        ? `Scade ${new Date(r.session_expires_at).toLocaleDateString('it-IT')}`
                        : 'Accesso permanente'}
                    </p>
                  </div>
                  <form action={revokeAccess}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-rose-200 hover:bg-rose-400/20">
                      Revoca
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* RICHIESTE ACCESSO */}
        <Section title="Richieste di accesso">
          {(reqs.data ?? []).length === 0 ? (
            <Empty>Nessuna richiesta.</Empty>
          ) : (
            <ul className="space-y-3">
              {reqs.data!.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{r.email}</p>
                      <p className="text-xs text-muted">{new Date(r.created_at).toLocaleString('it-IT')}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                        r.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : r.status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.reason}</p>
                  {r.status === 'pending' ? (
                    <div className="mt-4 flex gap-2">
                      <form action={approveRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/20">
                          Approva
                        </button>
                      </form>
                      <form action={rejectRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-rose-200 hover:bg-rose-400/20">
                          Rifiuta
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* HI-RES REQUESTS */}
        <Section title="Richieste alta risoluzione">
          {(hiRes.data ?? []).length === 0 ? (
            <Empty>Nessuna richiesta.</Empty>
          ) : (
            <ul className="space-y-3">
              {hiRes.data!.map((r) => {
                const photo = Array.isArray(r.photo)
                  ? (r.photo[0] as any)
                  : (r.photo as any);
                const folder = photo?.folder
                  ? Array.isArray(photo.folder)
                    ? photo.folder[0]
                    : photo.folder
                  : null;
                return (
                  <li key={r.id} className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{r.email}</p>
                        <p className="text-xs text-muted">
                          {folder?.name ? `Cartella: ${folder.name} · ` : ''}
                          {photo?.caption ?? 'Foto senza didascalia'}
                        </p>
                        <p className="text-xs text-muted">{new Date(r.created_at).toLocaleString('it-IT')}</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/80">
                        {r.status}
                      </span>
                    </div>
                    {r.message ? <p className="mt-3 whitespace-pre-line text-muted">{r.message}</p> : null}
                    {r.status === 'pending' ? (
                      <form action={markHiResSent} className="mt-4">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/15">
                          Segna come inviata
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* CARTELLE */}
        <Section title="Cartelle">
          <form
            action={createFolder}
className="grid gap-3 rounded-2xl border border-white/10 bg-black/60 p-5 sm:grid-cols-2"
          >
            <label className="block text-xs text-muted">
              Nome cartella
              <input
                name="name"
                required
                minLength={2}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </label>
            <label className="block text-xs text-muted">
              Cover (opzionale)
              <input
                type="file"
                name="cover"
                accept="image/*"
                className="mt-2 w-full text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.2em] file:text-white"
              />
            </label>
            <label className="block text-xs text-muted sm:col-span-2">
              Descrizione (opzionale)
              <textarea
                name="description"
                rows={2}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Caricamento…">Crea cartella</SubmitButton>
            </div>
          </form>

          <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
            ⠿ Trascina le cartelle per riordinarle
          </p>
          <DraggableList
            items={folders.data ?? []}
            type="folder"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            renderItem={(f) => {
              const folderPhotos = photosByFolder.get(f.id) ?? [];
              const cover = publicPhotoUrl(f.cover_storage_path);
              return (
                <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">/{f.slug}</p>
                      <h3 className="text-lg font-semibold text-white">{f.name}</h3>
                    </div>
                    <form action={deleteFolder}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="text-xs uppercase tracking-[0.2em] text-rose-300 hover:underline">
                        Elimina
                      </button>
                    </form>
                  </div>

                  {cover ? (
                    <div className="relative mt-3 h-32 overflow-hidden rounded-xl bg-white/5">
                      <Image src={cover} alt="" fill sizes="320px" className="object-cover" />
                    </div>
                  ) : null}

                  <p className="mt-3 text-xs text-muted">{folderPhotos.length} foto</p>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-white/80">
                      Carica foto ({folderPhotos.length} presenti)
                    </summary>
                    <div className="mt-3">
                      <PhotoUploader folderId={f.id} folderSlug={f.slug} />
                    </div>

                    {folderPhotos.length > 0 && (
                      <>
                        <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-muted">
                          ⠿ Trascina per riordinare le foto
                        </p>
                        <DraggableList
                          items={folderPhotos}
                          type="photo"
                          className="mt-1 space-y-2"
                          renderItem={(p) => (
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-2 text-xs">
                              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
                                {publicPhotoUrl(p.storage_path) ? (
                                  <Image
                                    src={publicPhotoUrl(p.storage_path)!}
                                    alt=""
                                    fill
                                    sizes="64px"
                                    className="object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-white">{p.caption ?? '— senza didascalia —'}</p>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                                  {p.hi_res_storage_path ? 'hi-res ✓' : 'solo preview'}
                                </p>
                              </div>
                              <form action={deletePhoto}>
                                <input type="hidden" name="id" value={p.id} />
                                <button className="text-[10px] uppercase tracking-[0.2em] text-rose-300 hover:underline">
                                  Elimina
                                </button>
                              </form>
                            </div>
                          )}
                        />
                      </>
                    )}
                  </details>

                  <Link
                    href={`/galleries/${f.slug}`}
                    className="mt-3 inline-block text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white"
                  >
                    Apri pagina pubblica →
                  </Link>
                </div>
              );
            }}
          />
        </Section>

        {/* IMPOSTAZIONI */}
        <Section title="Impostazioni sito & contatti">
          <form
            action={updateSettings}
className="grid gap-4 rounded-2xl border border-white/10 bg-black/60 p-5 sm:grid-cols-2"
          >
            <Field label="Nome sito" name="site_name" defaultValue={settings.site_name} />
            <Field label="Nome (es. Federico Azzarito)" name="bio_name" defaultValue={settings.bio_name} />
            <Field label="Ruolo (es. Fotografo)" name="bio_title" defaultValue={settings.bio_title} />
            <Textarea
              label="Testo bio"
              name="bio_text"
              defaultValue={settings.bio_text}
              className="sm:col-span-2"
            />
            <Field
              label="WhatsApp URL (es. https://wa.me/393…)"
              name="whatsapp_url"
              defaultValue={settings.whatsapp_url}
            />
            <Field
              label="Telegram URL (es. https://t.me/utente)"
              name="telegram_url"
              defaultValue={settings.telegram_url}
            />
            <Field
              label="Instagram URL"
              name="instagram_url"
              defaultValue={settings.instagram_url}
              className="sm:col-span-2"
            />
            <label className="block text-xs text-muted sm:col-span-2">
              Avatar bio (opzionale, sostituisce quello esistente)
              <input
                type="file"
                name="bio_avatar"
                accept="image/*"
                className="mt-2 w-full text-sm text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.2em] file:text-white"
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Salvataggio…">Salva impostazioni</SubmitButton>
            </div>
          </form>
        </Section>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/40 p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  className
}: {
  label: string;
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-muted ${className ?? ''}`}>
      {label}
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  defaultValue,
  className
}: {
  label: string;
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-muted ${className ?? ''}`}>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ''}
        rows={4}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
      />
    </label>
  );
}

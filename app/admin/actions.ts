'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import supabaseAdmin from '../../lib/supabaseServer';
import { verify, randomToken } from '../../lib/auth';
import { ADMIN_COOKIE } from '../../lib/session';
import { slugify, PHOTOS_BUCKET, HIRES_BUCKET } from '../../lib/storage';
import { parseSlideSeconds, backgroundStoragePath } from '../../lib/homeSlides';

/** Wrap Supabase Storage errors so "fetch failed" becomes attionable */
function diagnoseError(e: unknown, where: string): Error {
  if (e instanceof TypeError && /fetch failed/i.test(e.message)) {
    return new Error(
      `Connessione a Supabase fallita (${where}). ` +
        'Cause probabili: il progetto Supabase è in pausa, oppure il bucket "photos" / "hi-res" non esiste. ' +
        'Vai su Supabase → Storage e verifica che entrambi i bucket esistano. ' +
        'Vai su Supabase → Project (home) e riattiva il progetto se è in pausa.'
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

function requireAdmin() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(token);
  if (!payload || payload.act !== 'admin-session') {
    throw new Error('Non autorizzato.');
  }
}

const SESSION_TTL_DAYS = 30;

export async function approveRequest(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');

  const { data: existing } = await supabaseAdmin
    .from('access_requests')
    .select('id,email,status')
    .eq('id', id)
    .single();
  if (!existing) throw new Error('Richiesta non trovata');
  if (existing.status === 'approved') {
    revalidatePath('/admin');
    redirect('/admin?saved=approve');
  }

  // Accesso permanente: session_expires_at = NULL → nessuna scadenza.
  // Niente email all'utente: il cookie nel suo browser basta per entrare.
  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'approved',
      session_expires_at: null,
      consumed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/');
  redirect('/admin?saved=approve');
}

export async function swapFolderOrder(formData: FormData) {
  requireAdmin();
  const idA = String(formData.get('idA') ?? '');
  const idB = String(formData.get('idB') ?? '');
  if (!idA || !idB) return;

  const { data } = await supabaseAdmin
    .from('folders')
    .select('id,sort_order')
    .in('id', [idA, idB]);

  if (!data || data.length !== 2) return;
  const [a, b] = data;
  await supabaseAdmin.from('folders').update({ sort_order: b.sort_order }).eq('id', a.id);
  await supabaseAdmin.from('folders').update({ sort_order: a.sort_order }).eq('id', b.id);

  revalidatePath('/admin');
  revalidatePath('/galleries');
  redirect('/admin?saved=reorder');
}

export async function swapPhotoOrder(formData: FormData) {
  requireAdmin();
  const idA = String(formData.get('idA') ?? '');
  const idB = String(formData.get('idB') ?? '');
  if (!idA || !idB) return;

  const { data } = await supabaseAdmin
    .from('photos')
    .select('id,sort_order,folder_id')
    .in('id', [idA, idB]);

  if (!data || data.length !== 2) return;
  const [a, b] = data;
  await supabaseAdmin.from('photos').update({ sort_order: b.sort_order }).eq('id', a.id);
  await supabaseAdmin.from('photos').update({ sort_order: a.sort_order }).eq('id', b.id);

  const folderId = a.folder_id;
  const { data: folder } = await supabaseAdmin
    .from('folders').select('slug').eq('id', folderId).single();

  revalidatePath('/admin');
  if (folder) revalidatePath(`/galleries/${folder.slug}`);
  redirect('/admin?saved=reorder');
}

export async function revokeAccess(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');

  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'rejected', session_expires_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  redirect('/admin?saved=revoke');
}

export async function rejectRequest(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');

  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'rejected', consumed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  redirect('/admin?saved=reject');
}

export async function markHiResSent(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');
  const { error } = await supabaseAdmin
    .from('hi_res_requests')
    .update({ status: 'sent' })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  redirect('/admin?saved=hires');
}

const folderSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional()
});

export async function createFolder(formData: FormData) {
  requireAdmin();
  const parsed = folderSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || undefined
  });
  const slug = slugify(parsed.name);
  if (!slug) throw new Error('Slug non valido');

  const cover = formData.get('cover') as File | null;
  let coverPath: string | null = null;

  if (cover && cover.size > 0) {
    const ext = (cover.name.split('.').pop() ?? 'jpg').toLowerCase();
    coverPath = `covers/${slug}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await cover.arrayBuffer());
    try {
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(PHOTOS_BUCKET)
        .upload(coverPath, buffer, { contentType: cover.type, upsert: true });
      if (uploadErr) throw new Error(`Upload cover fallito: ${uploadErr.message}`);
    } catch (e) {
      throw diagnoseError(e, 'upload cover');
    }
  }

  const { error } = await supabaseAdmin.from('folders').insert({
    name: parsed.name,
    slug,
    description: parsed.description ?? null,
    cover_storage_path: coverPath
  });

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/galleries');
  redirect('/admin?saved=folder');
}

export async function updateFolderCover(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');

  const cover = formData.get('cover') as File | null;
  if (!cover || cover.size === 0) throw new Error('Nessuna immagine selezionata.');

  const { data: folder } = await supabaseAdmin
    .from('folders')
    .select('slug,cover_storage_path')
    .eq('id', id)
    .single();
  if (!folder) throw new Error('Cartella non trovata');

  const ext = (cover.name.split('.').pop() ?? 'jpg').toLowerCase();
  const coverPath = `covers/${folder.slug}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await cover.arrayBuffer());
  try {
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload(coverPath, buffer, { contentType: cover.type, upsert: true });
    if (uploadErr) throw new Error(`Upload cover fallito: ${uploadErr.message}`);
  } catch (e) {
    throw diagnoseError(e, 'upload cover');
  }

  const { error } = await supabaseAdmin
    .from('folders')
    .update({ cover_storage_path: coverPath })
    .eq('id', id);
  if (error) throw new Error(error.message);

  // Rimuove la vecchia cover per non lasciare file inutili nello Storage.
  if (folder.cover_storage_path && folder.cover_storage_path !== coverPath) {
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([folder.cover_storage_path]);
  }

  revalidatePath('/admin');
  revalidatePath('/galleries');
  revalidatePath('/');
}

export async function deleteFolder(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');
  const { error } = await supabaseAdmin.from('folders').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  revalidatePath('/galleries');
  redirect('/admin?saved=folder-deleted');
}

export async function deletePhoto(formData: FormData) {
  requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id mancante');

  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('storage_path,hi_res_storage_path,folder:folder_id(slug)')
    .eq('id', id)
    .single();

  if (photo) {
    if (photo.storage_path) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
    if (photo.hi_res_storage_path) await supabaseAdmin.storage.from(HIRES_BUCKET).remove([photo.hi_res_storage_path]);
    // Eventuale versione grande usata come sfondo della home.
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([backgroundStoragePath(id)]);
  }

  const { error } = await supabaseAdmin.from('photos').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/galleries');
  redirect('/admin?saved=photo-deleted');
}

export async function updateSettings(formData: FormData) {
  requireAdmin();
  const keys = [
    'site_name',
    'bio_name',
    'bio_title',
    'bio_text',
    'whatsapp_url',
    'telegram_url',
    'instagram_url'
  ];

  for (const key of keys) {
    const value = String(formData.get(key) ?? '').trim();
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(`${key}: ${error.message}`);
  }

  // avatar opzionale
  const avatar = formData.get('bio_avatar') as File | null;
  if (avatar && avatar.size > 0) {
    const ext = (avatar.name.split('.').pop() ?? 'jpg').toLowerCase();
    const path = `bio/avatar-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await avatar.arrayBuffer());
    try {
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(PHOTOS_BUCKET)
        .upload(path, buffer, { contentType: avatar.type, upsert: true });
      if (uploadErr) throw new Error(`Upload avatar fallito: ${uploadErr.message}`);
    } catch (e) {
      throw diagnoseError(e, 'upload avatar');
    }
    await supabaseAdmin
      .from('site_settings')
      .upsert({ key: 'bio_avatar_path', value: path, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  revalidatePath('/admin');
  revalidatePath('/bio');
  revalidatePath('/');
  redirect('/admin?saved=settings');
}

/** Foto e ritmo dello slideshow di sfondo della home. */
export async function updateHomeSlides(formData: FormData) {
  requireAdmin();

  const paths = formData
    .getAll('slides')
    .map((value) => String(value).trim())
    .filter(Boolean);

  const seconds = parseSlideSeconds(formData.get('home_slide_seconds') as string | null);

  const rows = [
    { key: 'home_slides', value: JSON.stringify(paths) },
    { key: 'home_slide_seconds', value: String(seconds) }
  ];

  for (const row of rows) {
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(`${row.key}: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  redirect('/admin?saved=home');
}

export async function adminLogout() {
  cookies().delete(ADMIN_COOKIE);
  redirect('/admin/login');
}

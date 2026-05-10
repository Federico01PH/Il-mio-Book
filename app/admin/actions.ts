'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import supabaseAdmin from '../../lib/supabaseServer';
import { verify, randomToken } from '../../lib/auth';
import { ADMIN_COOKIE } from '../../lib/session';
import { sendMagicLinkEmail } from '../../lib/mailer';
import { env } from '../../lib/env';
import { slugify, PHOTOS_BUCKET, HIRES_BUCKET } from '../../lib/storage';

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

  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'approved',
      session_token: sessionToken,
      session_expires_at: expiresAt.toISOString(),
      consumed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  const accessLink = `${env.siteUrl}/api/access?token=${encodeURIComponent(sessionToken)}`;
  try {
    await sendMagicLinkEmail(existing.email, accessLink);
  } catch (e) {
    console.error('[admin approve] invio email fallito:', e);
  }

  revalidatePath('/admin');
  redirect('/admin?saved=approve');
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
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload(coverPath, buffer, { contentType: cover.type, upsert: true });
    if (uploadErr) throw new Error(`Upload cover fallito: ${uploadErr.message}`);
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

const photoSchema = z.object({
  folderId: z.string().uuid(),
  caption: z.string().trim().max(280).optional()
});

export async function uploadPhoto(formData: FormData) {
  requireAdmin();
  const parsed = photoSchema.parse({
    folderId: formData.get('folderId'),
    caption: formData.get('caption') || undefined
  });

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) throw new Error('File mancante');

  const { data: folder } = await supabaseAdmin
    .from('folders')
    .select('slug')
    .eq('id', parsed.folderId)
    .single();
  if (!folder) throw new Error('Cartella non trovata');

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const baseName = `${Date.now()}-${randomToken(6)}`;
  const photoPath = `${folder.slug}/${baseName}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(photoPath, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error(`Upload foto fallito: ${uploadErr.message}`);

  let hiResPath: string | null = null;
  const hiResFile = formData.get('hiRes') as File | null;
  if (hiResFile && hiResFile.size > 0) {
    const hiExt = (hiResFile.name.split('.').pop() ?? 'jpg').toLowerCase();
    hiResPath = `${folder.slug}/${baseName}.${hiExt}`;
    const hiBuffer = Buffer.from(await hiResFile.arrayBuffer());
    const { error: hiErr } = await supabaseAdmin.storage
      .from(HIRES_BUCKET)
      .upload(hiResPath, hiBuffer, { contentType: hiResFile.type, upsert: false });
    if (hiErr) throw new Error(`Upload hi-res fallito: ${hiErr.message}`);
  }

  const { error } = await supabaseAdmin.from('photos').insert({
    folder_id: parsed.folderId,
    storage_path: photoPath,
    caption: parsed.caption ?? null,
    hi_res_storage_path: hiResPath
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/galleries');
  revalidatePath(`/galleries/${folder.slug}`);
  redirect('/admin?saved=photo');
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
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload(path, buffer, { contentType: avatar.type, upsert: true });
    if (uploadErr) throw new Error(`Upload avatar fallito: ${uploadErr.message}`);
    await supabaseAdmin
      .from('site_settings')
      .upsert({ key: 'bio_avatar_path', value: path, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  revalidatePath('/admin');
  revalidatePath('/bio');
  revalidatePath('/');
  redirect('/admin?saved=settings');
}

export async function adminLogout() {
  cookies().delete(ADMIN_COOKIE);
  redirect('/admin/login');
}

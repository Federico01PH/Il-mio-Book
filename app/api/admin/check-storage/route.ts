import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../../lib/supabaseServer';
import { verify } from '../../../../lib/auth';
import { ADMIN_COOKIE } from '../../../../lib/session';
import { PHOTOS_BUCKET, HIRES_BUCKET } from '../../../../lib/storage';

export const runtime = 'nodejs';

function requireAdmin() {
  const adminToken = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verify(adminToken);
  if (!payload || payload.act !== 'admin-session') return false;
  return true;
}

/** GET – diagnostica generale */
export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  const result: Record<string, unknown> = {};

  // Verifica connessione DB
  try {
    const { data, error } = await supabaseAdmin.from('folders').select('id').limit(1);
    result.db = error ? `ERRORE: ${error.message}` : `OK (${data?.length ?? 0} cartelle trovate)`;
  } catch (e) {
    result.db = `ERRORE connessione: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Lista bucket
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      result.storage_buckets = `ERRORE listBuckets: ${error.message}`;
    } else {
      result.storage_buckets = buckets.map((b) => `${b.name} (${b.public ? 'pubblico' : 'privato'})`);
      result[PHOTOS_BUCKET] = buckets.some((b) => b.name === PHOTOS_BUCKET) ? 'ESISTE' : 'MANCANTE';
      result[HIRES_BUCKET]  = buckets.some((b) => b.name === HIRES_BUCKET)  ? 'ESISTE' : 'MANCANTE';
    }
  } catch (e) {
    result.storage_buckets = `ERRORE: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Conteggi DB
  try {
    const { count: fc } = await supabaseAdmin.from('folders').select('id', { count: 'exact', head: true });
    const { count: pc } = await supabaseAdmin.from('photos').select('id', { count: 'exact', head: true });
    result.cartelle_db = fc ?? 0;
    result.foto_db = pc ?? 0;
  } catch (e) {
    result.conteggi = `ERRORE: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(result);
}

/** POST – test upload di un pixel nel bucket photos */
export async function POST() {
  if (!requireAdmin()) {
    return NextResponse.json({ message: 'Non autorizzato.' }, { status: 401 });
  }

  // Pixel PNG 1x1 trasparente (35 byte)
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  const testPath = `_test/check-${Date.now()}.png`;

  const result: Record<string, unknown> = { test_path: testPath };

  // Tenta upload
  try {
    const { error: upErr } = await supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload(testPath, pixel, { contentType: 'image/png', upsert: true });

    if (upErr) {
      result.upload = `ERRORE: ${upErr.message}`;
      return NextResponse.json(result, { status: 200 });
    }
    result.upload = 'OK';
  } catch (e) {
    result.upload = `ECCEZIONE: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json(result, { status: 200 });
  }

  // Verifica URL pubblico
  const { data: urlData } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(testPath);
  result.url_pubblico = urlData.publicUrl;

  // Cleanup
  try {
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([testPath]);
    result.cleanup = 'OK';
  } catch {
    result.cleanup = 'warning: file test non rimosso';
  }

  return NextResponse.json(result);
}

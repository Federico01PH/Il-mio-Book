/**
 * Autenticazione admin con password cifrata nel database.
 *
 * La password admin viene salvata come hash scrypt nella tabella `site_settings`
 * (chiave `admin_password_hash`). Finche' non ne viene impostata una dal reset,
 * si continua a usare la variabile d'ambiente ADMIN_SECRET (retro-compatibilita').
 *
 * Il reset via email usa un token casuale: nel DB salviamo solo il suo SHA-256
 * con scadenza (chiave `admin_reset_token`), il token in chiaro va solo nell'email.
 */
import supabaseAdmin from './supabaseServer';
import {
  hashPassword,
  verifyPasswordHash,
  sha256hex,
  randomToken,
  isAdminPassword
} from './auth';

const PW_KEY = 'admin_password_hash';
const RESET_KEY = 'admin_reset_token';

export const RESET_TTL_MIN = 30;
export const MIN_PASSWORD_LENGTH = 12;

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

async function clearSetting(key: string): Promise<void> {
  await supabaseAdmin.from('site_settings').delete().eq('key', key);
}

/** true se la password inserita e' corretta (hash nel DB oppure ADMIN_SECRET). */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const stored = await getSetting(PW_KEY);
  if (stored) return verifyPasswordHash(input, stored);
  return isAdminPassword(input);
}

/** Imposta la nuova password admin (cifrata) e annulla eventuali token di reset. */
export async function setAdminPassword(newPassword: string): Promise<void> {
  await setSetting(PW_KEY, hashPassword(newPassword));
  await clearSetting(RESET_KEY);
}

/** Crea un token di reset monouso e ne salva l'hash con scadenza. Ritorna il token in chiaro. */
export async function createResetToken(): Promise<string> {
  const token = randomToken(24);
  const expiry = Date.now() + RESET_TTL_MIN * 60 * 1000;
  await setSetting(RESET_KEY, `${sha256hex(token)}.${expiry}`);
  return token;
}

/** Verifica che il token di reset sia valido e non scaduto (non lo consuma). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const stored = await getSetting(RESET_KEY);
  if (!stored) return false;
  const sep = stored.lastIndexOf('.');
  if (sep < 0) return false;
  const hash = stored.slice(0, sep);
  const exp = Number(stored.slice(sep + 1));
  if (!hash || !Number.isFinite(exp) || Date.now() > exp) return false;
  return sha256hex(token) === hash;
}

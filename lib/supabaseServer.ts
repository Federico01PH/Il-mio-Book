import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export function getSupabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

const supabaseAdmin = getSupabaseAdmin();
export default supabaseAdmin;

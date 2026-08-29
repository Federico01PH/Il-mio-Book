import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export function getSupabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next mette in cache le fetch lato server, anche su disco: senza no-store
      // una risposta vista una volta resta congelata (es. l'elenco di una cartella
      // dello storage continua a sembrare vuoto anche dopo aver caricato i file).
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' })
    }
  });
}

const supabaseAdmin = getSupabaseAdmin();
export default supabaseAdmin;

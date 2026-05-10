import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);

export default supabase;

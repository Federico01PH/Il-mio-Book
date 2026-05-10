function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile d'ambiente ${name} mancante. Aggiungila al file .env`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get adminEmail() {
    return required('ADMIN_EMAIL');
  },
  get adminSecret() {
    const secret = required('ADMIN_SECRET');
    if (secret.length < 16) {
      throw new Error('ADMIN_SECRET deve essere lungo almeno 16 caratteri.');
    }
    return secret;
  },
  get mailerApiKey() {
    return optional('MAILER_API_KEY');
  },
  get mailerFrom() {
    return optional('MAILER_FROM');
  },
  get siteUrl() {
    return optional('SITE_URL', 'http://localhost:3000').replace(/\/$/, '');
  },
  get siteName() {
    return optional('NEXT_PUBLIC_SITE_NAME', 'Portfolio');
  }
};

export function isMailerConfigured() {
  return Boolean(process.env.MAILER_API_KEY && process.env.MAILER_FROM);
}

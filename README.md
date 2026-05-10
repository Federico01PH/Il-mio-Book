# Portfolio Fotografico

Portfolio fotografico privato — accesso su invito, gallerie a cartelle, lightbox, richiesta hi-res e dashboard admin.

Stack: **Next.js 14 (App Router)** · **Supabase (DB + Storage)** · **Tailwind** · **Resend** per le email.

---

## 1. Setup iniziale

### 1.1 Requisiti

- Node.js **20+** (`node -v` per controllare)
- Account [Supabase](https://supabase.com) (free tier basta)
- Account [Resend](https://resend.com) per inviare email (free tier: 3.000 email/mese)

### 1.2 Variabili d'ambiente

Crea un file `.env` nella root (è già in `.gitignore`, non finisce su GitHub) usando `.env.example` come riferimento. Questi sono i valori che ti servono:

```env
NEXT_PUBLIC_SUPABASE_URL=...        # Supabase → Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Supabase → Project Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=...       # Supabase → Project Settings → API → service_role (segreto!)

ADMIN_EMAIL=tu@email.com            # qui arrivano le richieste di accesso
ADMIN_SECRET=...                    # stringa lunga e casuale, almeno 32 caratteri.
                                    # Serve a 2 cose: (1) firmare i link admin, (2) login dashboard.

MAILER_API_KEY=re_xxx               # Resend → API Keys
MAILER_FROM=Portfolio <noreply@tuodominio.com>   # mittente verificato su Resend

SITE_URL=http://localhost:3000      # in produzione metti il dominio reale (es. https://tuodominio.com)
NEXT_PUBLIC_SITE_NAME=Portfolio
```

> 💡 Per generare un `ADMIN_SECRET` sicuro: apri PowerShell e lancia
> `[Convert]::ToBase64String((1..48 | %{ Get-Random -Maximum 256 }))`

### 1.3 Setup Supabase

1. Crea un nuovo progetto su Supabase.
2. Vai in **SQL Editor** e incolla il contenuto di `supabase-init.sql`. Esegui.
   Questo crea le tabelle, gli indici, abilita la RLS, e crea i bucket di Storage `photos` (pubblico) e `hi-res` (privato).
3. Vai su **Storage** e verifica che i due bucket esistano. Se Supabase blocca la creazione automatica, creali manualmente con questi nomi e queste impostazioni di pubblicità.

### 1.4 Setup Resend

1. Registrati su Resend.
2. Verifica un dominio (consigliato) o usa il dominio di test fornito da Resend.
3. Vai su **API Keys**, crea una chiave, copiala in `MAILER_API_KEY`.
4. Imposta `MAILER_FROM` con un indirizzo del dominio verificato (es. `Portfolio <noreply@tuodominio.com>`).

### 1.5 Avvio

```bash
npm install
npm run dev
```

Apri http://localhost:3000.

---

## 2. Come usare il sito

### 2.1 Flusso utente

1. Un utente apre il sito → vede il **gate** (form email + motivazione).
2. Compila e invia → arriva una mail a `ADMIN_EMAIL` con due bottoni: **Approva** / **Rifiuta**.
3. Cliccando *Approva*, l'utente riceve a sua volta un'email con un link magico.
4. Cliccando il link, l'utente entra (cookie di sessione valido 30 giorni) e può navigare gallerie, bio, contatti.
5. Dentro una galleria, cliccando una foto si apre il **lightbox**. Se la foto ha una versione hi-res caricata, l'utente può richiederla con un messaggio: la richiesta arriva via email all'admin.

### 2.2 Dashboard admin

- URL: **`/admin/login`**
- Password: il valore di `ADMIN_SECRET`.
- Sessione admin: 7 giorni (cookie firmato HMAC).

Da `/admin` puoi:

- Approvare / rifiutare richieste di accesso (anche in alternativa ai link in email).
- Vedere le richieste hi-res pending e segnarle come *inviate* dopo aver mandato il file.
- **Creare cartelle** (con cover opzionale) e **caricare foto** dentro ogni cartella.
- Per ogni foto puoi caricare anche una **versione hi-res privata**: solo l'admin la possiede, e gli utenti la richiedono via il pulsante nel lightbox.
- Modificare bio (titolo, testo, avatar) e i link **WhatsApp / Telegram / Instagram** mostrati in `/bio`.

---

## 3. Come caricare le foto

1. Login su `/admin/login`.
2. Sezione **Cartelle** → "Crea cartella": nome, descrizione, cover (opzionale).
3. Espandi la cartella creata → "Gestisci foto" → carica una foto alla volta.
   - **File**: l'immagine pubblica (anteprima nel sito).
   - **Didascalia**: opzionale, mostrata sotto la foto.
   - **Hi-res**: opzionale, file ad alta risoluzione che resta privato (bucket separato). Quando un utente lo richiede dal lightbox, ricevi una mail e puoi inviarlo manualmente.
4. La galleria pubblica è subito visibile su `/galleries/<slug-cartella>`.

> Il bucket `photos` è pubblico (servito tramite CDN Supabase). Il bucket `hi-res` è privato: solo il server può accedervi tramite la service role key.

---

## 4. Cosa serve per attivare email + WhatsApp + Telegram + Instagram

### Email (richieste accesso, magic link, notifiche hi-res)

- **Account Resend** (consigliato — già integrato): `MAILER_API_KEY` + `MAILER_FROM`.
- Verifica del dominio mittente su Resend, altrimenti le mail finiscono in spam.
- Senza queste env il sito **funziona comunque** ma le email vengono solo loggate in console — utile in sviluppo, inutile in produzione. In produzione vanno configurate.

### WhatsApp

- Vai sulla dashboard → **Impostazioni** → campo *WhatsApp URL*.
- Formato: `https://wa.me/393XXXXXXXXX` (numero internazionale senza `+` e senza spazi).
- Per un canale broadcast: `https://whatsapp.com/channel/<id-canale>`.

### Telegram

- Stesso pannello → *Telegram URL*.
- Formato: `https://t.me/tuonomeutente` o `https://t.me/+<invite-code>` per gruppi/canali privati.

### Instagram

- Stesso pannello → *Instagram URL*.
- Formato: `https://instagram.com/tuonomeutente`.

I tre link compaiono come bottoni nella pagina `/bio`. Lasciali vuoti se non li vuoi mostrare: il bottone non appare.

---

## 5. Struttura del progetto

```
app/
  page.tsx                    # gate o home in base alla sessione
  layout.tsx                  # layout root + Toaster + metadata
  loading.tsx · error.tsx · not-found.tsx
  api/
    request-access/           # POST: nuova richiesta
    approve/ · reject/        # GET: link admin firmati HMAC
    access/                   # GET: setta cookie da magic link
    hi-res-request/           # POST: utente richiede alta risoluzione
    logout/                   # POST: termina sessione utente
    admin/login · logout/     # auth dashboard
  galleries/
    page.tsx                  # lista cartelle
    [slug]/
      page.tsx                # dettaglio (server, fetch da DB)
      GalleryClient.tsx       # lightbox + mouse preview + hi-res form
  bio/page.tsx                # bio + contatti dinamici
  admin/
    login/                    # form login
    page.tsx                  # dashboard
    actions.ts                # server actions
components/
  AccessGate.tsx · InternalHome.tsx
lib/
  env.ts                      # env type-safe
  auth.ts                     # HMAC sign/verify, password admin
  session.ts                  # validazione cookie sessione
  storage.ts                  # helpers Supabase Storage
  mailer.ts                   # template + invio Resend
  supabaseClient.ts · supabaseServer.ts
middleware.ts                 # protezione route /galleries /bio /admin
supabase-init.sql             # schema + RLS + buckets
```

---

## 6. Deploy in produzione (Vercel)

1. Pusha il progetto su GitHub.
2. Su Vercel → "New Project" → seleziona il repo.
3. Aggiungi tutte le variabili d'ambiente di `.env` nel pannello Vercel (Settings → Environment Variables).
4. Cambia `SITE_URL` con il dominio reale (`https://...`) — fondamentale per i link nelle email.
5. Deploy.

> Dopo il primo deploy, controlla in Supabase che `Auth → Site URL` punti al dominio Vercel se userai mai magic link Supabase nativi (qui non serve, ma è buona pratica).

---

## 7. Sicurezza & note

- Tutte le tabelle hanno **Row Level Security** abilitata: nessun client anonimo può leggerle. Il sito legge/scrive sempre via service role lato server.
- I link admin nelle email sono firmati **HMAC-SHA256** con `ADMIN_SECRET` e scadono in 72 ore. Non sono indovinabili anche se vengono rubati.
- La password admin è confrontata con timing-safe equality.
- Le sessioni utente sono token random a 32 byte memorizzati in DB con scadenza esplicita; al logout vengono invalidate.
- Le foto pubbliche sono servite dalla CDN Supabase. Le hi-res non sono mai esposte a URL pubblici.

---

## 8. Comandi utili

```bash
npm run dev          # sviluppo
npm run build        # build produzione
npm run start        # avvia build prodotto
npm run lint         # lint
npm run typecheck    # verifica TypeScript
```

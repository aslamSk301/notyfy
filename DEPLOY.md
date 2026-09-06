# Deploy NotifyMVP on your Cloudflare account

Self-host a OneSignal-style push dashboard on **Cloudflare Workers + D1 + R2**, and send notifications through **your own Firebase Cloud Messaging** project.

No NotifyMVP cloud bill. You pay only what Cloudflare and Firebase already give you on their free tiers (or your existing paid plans).

If this helped your startup, **star the repo**.

---

## What you get

| Piece | Role |
|---|---|
| **Cloudflare Worker** | Dashboard + public device/register + send APIs |
| **D1** | SQLite database (users, projects, devices, topics) — **not** a bucket |
| **R2** | Private bucket for each project's Firebase service-account JSON |
| **Google OAuth + email login** | Dashboard authentication (Better Auth + Google) |
| **Firebase FCM** | Actual push delivery (topics + tokens) |

---

## What you need

1. A [Cloudflare](https://dash.cloudflare.com/sign-up) account
2. Node.js 20+ and npm
3. [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npx wrangler` is enough)
4. A free [Google Cloud](https://console.cloud.google.com/) OAuth client (Web application)
5. A [Firebase](https://console.firebase.google.com/) project with Cloud Messaging enabled, plus a **service account JSON**

Optional: a custom domain on Cloudflare.

---

## 1. Clone and install

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/notifyMVP.git
cd notifyMVP/my-app
npm install
npx wrangler login
```

---

## 2. Create the D1 database

D1 is Cloudflare's SQLite database. Create one, then copy the `database_id`.

```bash
npx wrangler d1 create notifymvp-db
```

Example output:

```text
database_name = "notifymvp-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Paste that id into `wrangler.jsonc` → `d1_databases[0].database_id`.

Keep the binding name as `DB`. The app reads `env.DB`.

---

## 3. Create the R2 bucket

R2 stores Firebase credentials. It is a **private object store**, not a database. Do not make the bucket public.

```bash
npx wrangler r2 bucket create firebase-credentials
```

`wrangler.jsonc` should already have:

```jsonc
"r2_buckets": [
  { "binding": "R2", "bucket_name": "firebase-credentials" }
]
```

If you used another bucket name, change `bucket_name` only. Keep `binding` as `R2`.

---

## 4. Edit `wrangler.jsonc`

Update these three things before the first deploy:

```jsonc
{
  "name": "notifymvp",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "notifymvp-db",
      "database_id": "YOUR-D1-DATABASE-ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "firebase-credentials"
    }
  ],
  "vars": {
    "NEXT_PUBLIC_APP_URL": "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
  }
}
```

`NEXT_PUBLIC_APP_URL` must be the public URL of the Worker (or your custom domain). After the first deploy Wrangler prints a `*.workers.dev` URL — put that here and deploy once more.

---

## 5. Run D1 migrations (in order)

Run **once** against the remote database. Do not skip files.

```bash
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0000_initial.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0001_enhanced_devices_topics.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0002_topics_description.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0003_device_topics.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0004_onesignal_architecture.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0005_fix_campaigns_columns.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0006_add_missing_campaign_columns.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0007_fix_devices_missing_columns.sql
npx wrangler d1 execute notifymvp-db --remote --file=drizzle/0008_better_auth_tables.sql
```

`0008` creates Better Auth tables (`ba_user`, `ba_session`, `ba_account`, `ba_verification`). Login will fail without it.

If an `ALTER TABLE ... ADD COLUMN` says the column already exists, that file was already applied — continue.

---

## 6. Authentication — what to put where

Dashboard login uses:

- **Email + password** (Better Auth)
- **Google Sign-In** (Google OAuth client)

Better Auth **requires** a secret and Google client credentials in production.

### 6a. Generate a Better Auth secret

```bash
openssl rand -base64 32
```

Then store it on the Worker (do not commit this):

```bash
npx wrangler secret put BETTER_AUTH_SECRET
```

Paste the random string when prompted.

### 6b. Google Cloud OAuth

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project (or create one).
2. **APIs & Services → OAuth consent screen** — External, app name e.g. `NotifyMVP`, your email.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized JavaScript origins:

   ```text
   http://localhost:3000
   https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev
   https://your-custom-domain.com
   ```

5. Authorized redirect URIs (add **all** you will use):

   ```text
   http://localhost:3000/api/auth/google/callback
   http://localhost:3000/api/auth/callback/google
   https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/auth/google/callback
   https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/auth/callback/google
   https://your-custom-domain.com/api/auth/google/callback
   https://your-custom-domain.com/api/auth/callback/google
   ```

   `/api/auth/google/callback` is the custom Google route. `/api/auth/callback/google` is Better Auth's default. Add both so login does not 400.

6. Copy the Client ID and Client Secret into Worker secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

### 6c. App URL for auth cookies

```bash
npx wrangler secret put BETTER_AUTH_URL
```

Use the same origin as `NEXT_PUBLIC_APP_URL` (no trailing slash), e.g. `https://notify.yourdomain.com`.

### 6d. Optional secrets

| Secret | Required? | What it is |
|---|---|---|
| `BETTER_AUTH_API_KEY` | No | Better Auth dashboard plugin (`ba_...`) if you use it |
| `JWT_SECRET` | Recommended | Signs the legacy Google-login cookie. `openssl rand -base64 32` |
| `RESEND_API_KEY` / `EMAIL_FROM` | No | Only if you later wire transactional email |

```bash
npx wrangler secret put JWT_SECRET
```

---

## 7. Deploy the Worker

From `my-app/`:

```bash
npm run deploy
```

That runs OpenNext (`opennextjs-cloudflare build`) then `wrangler deploy`.

You should see something like:

```text
https://notifymvp.YOUR-SUBDOMAIN.workers.dev
```

Open that URL → `/login`.

If `NEXT_PUBLIC_APP_URL` still points at someone else's domain, update `wrangler.jsonc` `vars` and deploy again.

---

## 8. Custom domain (optional)

Cloudflare Dashboard → **Workers & Pages** → `notifymvp` → **Settings → Domains & Routes** → add `notify.yourdomain.com`.

Then:

1. Set `vars.NEXT_PUBLIC_APP_URL` to `https://notify.yourdomain.com`
2. `npx wrangler secret put BETTER_AUTH_URL` → same URL
3. Add that origin + both callback URLs in Google OAuth
4. `npm run deploy` again

---

## 9. First-run product setup (Firebase)

1. Register / log in on your Worker URL.
2. **Projects** → create an app (you get `appId` + `apiKey`).
3. Firebase Console → Project settings → **Service accounts** → Generate new private key (JSON).
4. Upload that JSON on the NotifyMVP project card. It is stored in **R2** (`firebase-credentials`). The Worker never needs the file in git.
5. Put `appId` / `apiKey` in your Android / iOS / Flutter / RN SDK. Base URL = your Worker origin.

Devices register at:

```text
POST https://YOUR-ORIGIN/api/device/register
```

On register, the backend subscribes the FCM token to system topics (`all_…`, `os_…`, `country_…`, `language_…`, `version_…`).

---

## 10. Local development

```bash
cp .env.local.example .env.local
```

Fill at least:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=a-long-random-string-at-least-32-chars
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_D1_DATABASE_ID=...
CLOUDFLARE_API_TOKEN=...   # D1 Edit
```

`CLOUDFLARE_*` is only for `next dev` talking to remote D1 over HTTP. For bindings that match production:

```bash
npm run preview
# or
npm run dev:cf
```

Apply the same SQL files locally with `--local` if you use local D1.

---

## Cloudflare checklist (short)

**Workers**

- [ ] Worker name `notifymvp` (or change `wrangler.jsonc` `name`)
- [ ] `nodejs_compat` + `compatibility_date` already in config
- [ ] Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL`
- [ ] Var: `NEXT_PUBLIC_APP_URL`

**D1**

- [ ] Database `notifymvp-db` created
- [ ] `database_id` in `wrangler.jsonc`
- [ ] Binding name `DB`
- [ ] Migrations `0000` … `0008` applied `--remote`

**R2**

- [ ] Bucket `firebase-credentials` created
- [ ] Binding name `R2`
- [ ] Bucket stays **private**
- [ ] Firebase JSON uploaded from the dashboard (not from the CLI)

**Google Cloud**

- [ ] OAuth Web client
- [ ] Consent screen configured
- [ ] Redirect URIs for Worker URL + localhost (both callback paths)

**Firebase**

- [ ] Cloud Messaging enabled
- [ ] Service account JSON uploaded in NotifyMVP → Project

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Login says Google is not configured | `wrangler secret list` — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` |
| Google 400 / redirect_uri_mismatch | Exact callback URL in Google Console, including `https` and no trailing slash |
| Dashboard empty / DB errors | Migrations, especially `0008_better_auth_tables.sql` |
| “No Firebase credentials” | R2 binding + JSON uploaded on the project |
| Devices register but Topics = — | Open the app once after a successful deploy; register writes `device_topics` |
| Worker URL works, custom domain does not | Update `NEXT_PUBLIC_APP_URL` + `BETTER_AUTH_URL` + Google origins |

---

## Cost note

Cloudflare Workers, D1, and R2 have a free tier that is enough for early-stage apps. Firebase Cloud Messaging has no per-notification fee for the usual mobile use case. You are not paying NotifyMVP — there is no hosted billing.

OneSignal and similar products are moving toward paid plans that are hard on pre-revenue startups. This repo is **clone → configure Cloudflare → upload Firebase JSON → send**.

---

## License

[MIT](./LICENSE) — use it, fork it, ship it.

---

## Contribute

See [README.md](./README.md#contribute).

# NotifyMVP

Open-source push notifications for startups that cannot pay OneSignal prices.

Clone it. Deploy it on **your** Cloudflare account. Plug in **your** Firebase project. That is the product.

If this is useful, **star the repo** — it is the only “pricing page” we have.

[Deploy on Cloudflare](./DEPLOY.md) · [MIT License](./LICENSE) · [LinkedIn](https://www.linkedin.com/in/aslam-shahmadar-editbysk/)

---

## Why this exists

OneSignal-class tools are going paid. For a startup that is still finding users, a monthly push bill is the wrong bill.

NotifyMVP is a dashboard + device SDK + FCM topic fan-out you host yourself:

- Cloudflare **Workers** (app)
- Cloudflare **D1** (database & AES-256 encrypted Firebase credentials)
- **Firebase Cloud Messaging** (delivery)

No vendor lock on the notification SaaS. You already have Cloudflare and Firebase, or you can create both for free.

---

## Features

- Register Android / iOS / Flutter / React Native devices
- System FCM topics: all users, OS, country, language, app version (major + exact)
- Dashboard: send to all, platform, topic, or a single external user id
- Google + email login for the dashboard
- **Super Admin Portal (`/dashboard/admin`):** Full multi-tenant user management, role assignments, account suspension, and safe cascading deletion
- **AES-256-GCM Encrypted Credentials:** Firebase service account JSON is securely encrypted at rest in your D1 database (with zero-downtime fallback migration for legacy R2)

---

## Quick start

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/notifyMVP.git
cd notifyMVP/my-app
npm install
npx wrangler login
```

Then follow **[DEPLOY.md](./DEPLOY.md)** for D1, R2, Google OAuth, secrets, migrations, and `npm run deploy`.

After deploy:

1. Log in
2. Create a project (copy `appId` + `apiKey`)
3. Upload the Firebase service-account JSON
4. Install an SDK from the table below. Set `baseUrl` to **your** Worker URL (`https://notifymvp.<account>.workers.dev` or your custom domain)

---

## SDKs — kahan se download / install

`baseUrl` = **tumhara** Cloudflare Worker URL. `appId` + `apiKey` dashboard → Projects se.

| Platform | Download / install | Repo / package |
|---|---|---|
| **Android** | [JitPack — aslamSk301/notify-android-sdk](https://jitpack.io/#aslamSk301/notify-android-sdk) | [github.com/aslamSk301/notify-android-sdk](https://github.com/aslamSk301/notify-android-sdk) |
| **iOS** | Xcode → Add Package | [github.com/aslamSk301/notify-ios-sdk](https://github.com/aslamSk301/notify-ios-sdk) |
| **Flutter** | [pub.dev/packages/notify_mvp](https://pub.dev/packages/notify_mvp) | package name: `notify_mvp` |
| **React Native** | https://www.npmjs.com/package/@notifymvp/react-native-sdk | `npm i @notifymvp/react-native-sdk` |

### Android (JitPack)

```kotlin
// settings.gradle.kts
maven { url = uri("https://jitpack.io") }

// app/build.gradle.kts
implementation("com.github.aslamSk301:notify-android-sdk:1.1.1")
implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
implementation("com.google.firebase:firebase-messaging-ktx")
```

Docs: [notify_android_sdk/README.md](https://github.com/aslamSk301/notify-android-sdk#readme)

### iOS (Swift Package Manager)

```text
https://github.com/aslamSk301/notify-ios-sdk.git
```

Xcode → File → Add Package Dependencies… → paste URL. Docs: [notify-ios-sdk README](https://github.com/aslamSk301/notify-ios-sdk#readme)

### Flutter (pub.dev)

```yaml
dependencies:
  notify_mvp: ^1.0.2
```

```bash
flutter pub add notify_mvp
```

Package: [pub.dev/packages/notify_mvp](https://pub.dev/packages/notify_mvp)

### React Native (npm)

Package URL: https://www.npmjs.com/package/@notifymvp/react-native-sdk

```bash
npm install @notifymvp/react-native-sdk @react-native-firebase/app @react-native-firebase/messaging
```

Monorepo clone (source, not the store): `notify_android_sdk/`, `notify_ios_sdk/`, `notify_flutter_sdk/`, `notify_rn_sdk/` inside this repo.

---

## REST API (custom dashboard)

Auth: `Authorization: Bearer <apiKey>` (or `x-api-key`).

| Goal | Method | Path |
|---|---|---|
| Send (all / OS / user) | `POST` | `/api/v1/notifications` |
| List devices | `GET` | `/api/v1/devices` |
| List topics | `GET` | `/api/v1/topics` |
| Stats (total count) | `GET` | `/api/v1/stats` |

**Send to one user:** `"include_external_user_ids": ["USER_ID"]` or `"target": "user:USER_ID"` (SDK must have linked the id).

**Devices filters:** `platform`, `status`, `externalUserId`, `country`, `language`, `appVersion`, `limit`, `offset`. FCM tokens are masked.

**Topics filters:** `type=system|custom`, `active=true|false|all`.

Copy-paste examples: dashboard → **API Keys & Docs**.

---

## Super Admin & User Management

NotifyMVP comes with a built-in Super Admin panel located at `/dashboard/admin` for platform owners and administrators.

### Features
- **User Directory:** View all registered accounts, their linked auth providers (Google, Email), created projects, status, and join dates.
- **Role Management:** Assign roles (`user`, `admin`, `superadmin`).
- **Create & Manage Users:** Create accounts directly with email/password, reset passwords, and toggle user status (`active` vs `suspended`).
- **Cascading Cleanup on Deletion:** Deleting a user safely and completely purges all their associated projects, registered devices, FCM topics, notification campaigns, delivery logs, and automatically deletes their Firebase Service Account JSON credentials from the Cloudflare R2 bucket.

### Setting up Super Admin Access

You can grant Super Admin access using either method:

#### 1. Environment Variable / Secret (Recommended)
Add comma-separated emails to `SUPER_ADMIN_EMAILS`:

```bash
# In .env.local (for local development):
SUPER_ADMIN_EMAILS="admin@example.com,owner@yourdomain.com"
```

For production deployment on Cloudflare Workers:
```bash
npx wrangler secret put SUPER_ADMIN_EMAILS
```

#### 2. D1 Database Role (SQL)
Run D1 migration `0009_super_admin_roles.sql` and update your user record:

```bash
npx wrangler d1 execute notifymvp-db --command="UPDATE ba_user SET role = 'superadmin' WHERE email = 'your-email@example.com';"
```

*(Note: If no custom email is set, `contact.earnslash@gmail.com` is configured as the default fallback super admin).*

---

## Like / follow

- Star this GitHub repo if you deploy it or fork it
- Follow on LinkedIn: [https://www.linkedin.com/in/aslam-shahmadar-editbysk/](https://www.linkedin.com/in/aslam-shahmadar-editbysk/)

---

## Contribute

This is free software. Help is welcome.

1. Fork the repo
2. Create a branch: `git checkout -b fix/your-change`
3. Keep the change small (one bug or one feature)
4. Do not commit `.env`, Firebase JSON, or `wrangler` secrets
5. Open a pull request that says **why**, not only what

Useful contributions:

- Docs and deploy-guide fixes
- Dashboard UX
- SDK bugs (Android / iOS / Flutter / RN)
- D1 migration safety
- Tests around topic naming and register

Questions and bugs: GitHub Issues.

---

## License

[MIT](./LICENSE). Use it commercially. Attribution is the license notice in copies of the Software.

---

## Repo layout

```text
my-app/                 ← this dashboard (deploy this Worker)
notify_android_sdk/     ← JitPack: aslamSk301/notify-android-sdk
notify_ios_sdk/         ← SPM: github.com/aslamSk301/notify-ios-sdk
notify_flutter_sdk/     ← pub.dev: notify_mvp
notify_rn_sdk/          ← npm: @notifymvp/react-native-sdk
```

Full Cloudflare + auth + Firebase walkthrough: **[DEPLOY.md](./DEPLOY.md)**.

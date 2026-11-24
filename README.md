# NEXUS — LifeAfter Marketplace & Community

**BUY. SELL. TRADE. CONNECT.**

NEXUS is an independent fan-made LifeAfter marketplace and community. It is not affiliated with NetEase Games or the operators of LifeAfter.

## Included features

- Email/password registration, login, email verification flow, password reset and password update
- Player profiles with username, permanent NEXUS user code, bio, LifeAfter nickname, server, animated GIF avatar and banner
- Public/private profile visibility
- Marketplace listings: sale, wanted, trade and giveaway; category, server, text search, up to five images, mark sold
- Social feed with posts, image/GIF uploads, likes, comments and follows
- One-to-one text messaging and read markers; **no groups or group chats**
- Player discovery by username or NEXUS user code, follow/unfollow and friend requests
- 24-hour image/GIF stories
- Seller reviews after a direct-message conversation exists
- In-app notifications for reactions, comments, follows, messages and friend requests
- Reports, moderator/admin actions, moderation logs and announcements
- English, Simplified Chinese and Indonesian UI strings
- Self-service account deletion through a protected Supabase Edge Function
- No payment gateway; NEXUS does not process or guarantee payments

## Stack

- React 18 + Vite + Tailwind CSS
- Supabase Auth, Postgres, Row Level Security, Storage and Realtime
- Cloudflare Pages (recommended static hosting)

## 1. Supabase setup

Create a Supabase project. In **Project Settings → API**, copy the Project URL and anon/publishable key. Never use the service-role key in the browser.

Open **SQL Editor** and run these files in this exact order:

1. `supabase/001_core.sql`
2. `supabase/002_storage.sql`
3. `supabase/003_admin.sql`
4. `supabase/004_security_notifications.sql`
5. `supabase/005_community_features.sql`
6. `supabase/006_final_security.sql`

If you already ran migrations 001–004, run only 005 and 006. Do not rerun the old `003_admin.sql` file supplied separately by the original source; use the version inside this project.

### Create the first administrator

1. Register your own account and verify your email.
2. In Supabase SQL Editor, run this once, replacing the username:

```sql
update public.profiles set role = 'admin' where username = 'YOUR_USERNAME';
```

Do not give admin access to anyone you do not trust.

## 2. Account deletion Edge Function

The Account & Privacy page calls `delete-account`. Deploy the included function from the project root using the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-account
```

Keep `verify_jwt = true` in `supabase/config.toml`. Supabase supplies the function's URL, anon key and service-role key as Edge Function environment secrets. **Never copy the service-role key into `.env`, Vite variables, GitHub source, or Cloudflare Pages.**

The function deletes the signed-in user's media folder and Auth account; database rows with cascading foreign keys are removed by Postgres. Review any legal retention obligations before launch.

## 3. Run locally

Use Node.js 20 or newer:

```bash
npm install
cp .env.example .env.local
```

Set the two public values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Then run:

```bash
npm run dev
npm run build
```

## 4. Deploy on Cloudflare Pages

1. Push this project to a GitHub repository.
2. In Cloudflare Pages, create a project connected to that repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages environment variables for Production (and Preview if needed).
7. Deploy.

For Supabase Auth, add your deployed domain under **Authentication → URL Configuration → Site URL / Redirect URLs**. Also add your local dev URL if testing locally.

## 5. Storage and privacy notes

- The `media` bucket is public so listing, feed and story images can load without signed URLs. Do not upload private or sensitive images. A public bucket means anyone with a media URL may be able to view that file.
- Uploads are limited in the app to JPG, PNG, WEBP and GIF, maximum 2 MB each. Avatar and banner GIF animation is supported.
- Private profile visibility hides the profile record and posts/stories from normal discovery queries, but cannot make already-public media URLs private.
- Stories stop appearing after 24 hours. Their database rows and media files are not automatically purged by the app; configure Supabase Cron or periodically clean expired stories and orphaned media if storage usage matters.
- Seller reviews require at least one existing direct-message conversation with that seller. This is not proof that a trade was completed.
- Direct messages are text-only. No groups, group chats, payment processing, escrow or transaction guarantees.
- Account deletion Edge Function deployment is required for the delete button to work.

## 6. Before public launch

This is a source project, not a live deployed service. You must connect your own Supabase project and deploy it. Test with at least two normal accounts plus a moderator/admin account:

- Signup, email verification, login, logout and password recovery
- Listing creation, image upload, search, contact seller and mark sold
- Feed posts, reactions, comments, follow/unfollow and reports
- Friend requests in both directions and notification permissions
- Private profile visibility and message privacy
- Story expiry and GIF rendering
- Seller review eligibility and duplicate-review rejection
- Moderator/admin actions and moderation logs
- Account deletion and media cleanup
- Row Level Security with anon and authenticated roles

The project files passed a JavaScript/JSX syntax transpilation check in this environment. A full Vite production build could not be run because package installation timed out here. The SQL migrations have not been applied to a live Supabase instance in this environment. Treat the first deployment as a staging test, not a production launch.

## Project structure

```text
src/
  App.jsx
  Community.jsx
  Social.jsx
  Admin.jsx
  Legal.jsx
  components/ui.jsx
  i18n/index.js
  lib/supabase.js
supabase/
  001_core.sql
  002_storage.sql
  003_admin.sql
  004_security_notifications.sql
  005_community_features.sql
  006_final_security.sql
  functions/delete-account/index.ts
```

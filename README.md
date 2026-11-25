# NEXUS — LifeAfter Marketplace & Community (v0.2 revamp)

**BUY. SELL. TRADE. CONNECT.**

An independent fan-made LifeAfter marketplace and community. Not affiliated with NetEase Games or the operators of LifeAfter.

## What changed in this revamp

- **LifeAfter look**: dark Mist-and-hazard theme (amber, infected green, Mist teal), drifting fog and spores, HUD corner brackets, hazard-stripe dividers.
- **Animations**: page transitions, staggered card entrances, like-burst, message bubbles popping in, story rings, hover sweeps, skeleton loaders, toasts, pulsing unread badges. Everything switches off for people who use "reduce motion".
- **Username + password only.** No email field anywhere. (See "How no-email login works".)
- **Facebook-style layout**: top bar with search and nav, left shortcuts and right contacts on desktop, bottom tab bar on phones, Home feed with *Everyone / Following*, comments with replies, photo posts, 24-hour stories row.
- **Real profiles**: profile photo + banner (tap the camera buttons, GIFs stay animated), bio, LifeAfter nickname, server, camp, friends/followers counts, Posts / About / Friends tabs, friend / follow / message buttons, block and report.
- **Private DMs (Messenger-style)**: conversation list with unread counts and last message, live delivery, "Seen" receipts, photo messages, block, report. One-to-one only.
- **No groups, no group chats** — still none.
- Trading Post (marketplace) restyled; sellers can now delete their own listings; ratings average on seller reviews.
- Phone photos are shrunk automatically before upload, so camera pictures no longer fail the size limit. Upload limit is now 5 MB (GIFs are uploaded untouched).
- Still English / 简体中文 / Bahasa Indonesia — every screen is now translated (before, many labels were English only).

## Setup (do these in order)

### 1. Supabase

1. In **Authentication → Providers → Email**: keep Email **enabled** and turn **“Confirm email” OFF**. (Required for username-only sign-up. No emails are ever sent.)
2. In **SQL Editor**, run these files in order. If you already ran 001–006 earlier, run **only 007**:
   1. `supabase/001_core.sql`
   2. `supabase/002_storage.sql`
   3. `supabase/003_admin.sql`
   4. `supabase/004_security_notifications.sql`
   5. `supabase/005_community_features.sql`
   6. `supabase/006_final_security.sql`
   7. **`supabase/007_revamp.sql`** (new: realtime for live chat, DM photos, longer usernames, bigger uploads, friends list and unfriend)
3. Deploy the account-deletion function (unchanged):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy delete-account
   ```
   Never put the service-role key in `.env`, GitHub or Cloudflare.

### 2. Make yourself admin

Register on the site, then in SQL Editor:

```sql
update public.profiles set role = 'admin' where username = 'YOUR_USERNAME';
```

### 3. Run locally

Node 20+:

```bash
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev
```

### 4. Deploy on Cloudflare Pages

Framework preset **Vite**, build command `npm run build`, output `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, then deploy. No Site URL / redirect URL setup is needed any more because there are no email links.

## How no-email login works

Supabase Auth needs an email address, so NEXUS secretly turns each username into a placeholder such as `survivor_01@nexusplayers.com`. Nobody sees it and nothing is ever sent to it. Players only type their username and password.

- Because there is no email, **a forgotten password cannot be recovered by the player.** Signed-in players can change their password in Settings. If somebody is locked out, an admin can reset it in the SQL Editor:
  ```sql
  update auth.users set encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf'))
  where email = 'their_username@nexusplayers.com';
  ```
- If sign-up ever says the email address is invalid, set `VITE_LOGIN_DOMAIN` to a domain that you own, **before anyone signs up**. Never change it afterwards.
- Old accounts that were created with a real email will not match this scheme. Re-register test accounts (or ask for a migration script if you have real users).
- Supabase's minimum password length is 6 by default (Authentication → Policies); the app enforces 6 too.

## Privacy notes (please read)

- DM **text** is protected by database row-level security: only the sender and receiver can read it. It is **not end-to-end encrypted**, so whoever controls the Supabase project could technically read it.
- Images (posts, stories, DM photos, avatars, banners) live in a **public** storage bucket with unguessable file names. Don't send sensitive pictures.
- Private profiles are hidden from search and from other players' profile pages, but people you have messaged can still see your basic profile so chats keep working.
- Stories hide after 24 hours but the rows and files stay until you clean them up (a Supabase Cron example is at the bottom of 007).

## Test checklist (use two normal accounts + one admin)

- Sign up, log out, log in; wrong password message; duplicate username message
- Set profile photo and banner (try a big phone photo and a GIF); edit bio and server
- Post with and without a photo; like; comment and reply; delete your post
- Add a story and watch it; add friend → accept → unfriend; follow
- DM: send text and a photo, see it arrive live on the other account, "Seen" appears, unread badge clears; block / unblock
- Trading Post: create listing with photos, search, filter, contact seller, mark sold, delete
- Change password in Settings; switch language; private profile; delete account

## Honest status

This is source code. In my environment I could bundle all the code (every import resolves) and run it in a headless browser against a **fake** Supabase to confirm every page renders and the main interactions don't crash. I could **not** run `npm install` / the Tailwind build, apply the SQL to a real Supabase project, or look at the final styling on a phone — so treat the first deployment as a staging test and tell me about anything that looks or behaves off.

## Project structure

```text
src/
  App.jsx                 shell: top bar, nav, routing, unread badges
  main.jsx  styles.css    theme + animations
  lib/                    supabase client, helpers (upload, username login), router, social helpers, context
  i18n/                   en.js zh.js id.js + provider
  components/             ui.jsx, Icon.jsx, Post.jsx (feed/composer/comments), Stories.jsx
  pages/                  Auth Home Profile Messages Market Reviews People Friends Notifications Settings Admin Legal
supabase/                 001–007 SQL + delete-account function
```

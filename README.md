# Infinity Hoop Community

Custom members platform built from scratch to replace Skool. Branded to
Infinity Hoop, designed for 8,000+ women 25–55 who want fun daily movement,
real accountability, and a visible transformation.

> 📖 **Product spec & vision:** see [SPEC.md](./SPEC.md). Read that first.

---

## What's been built

A full production-grade Next.js 16 app. Every file is typed, linted, and
compiles cleanly (`tsc --noEmit` passes).

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Branded marketing landing page with hero, features, how-it-works, pricing, closing CTA |
| `/pricing` | Full pricing page with Stripe checkout forms for monthly / annual |
| `/sign-in`, `/sign-up` | Clerk-powered auth, branded |
| `/onboarding` | 3-step onboarding (goal, workout prefs, buddy preferences) |
| `/dashboard` | "Today" hub — streak, today's workout, today's recipe, active challenge, buddy card |
| `/workouts` | Library with filters + [slug] detail w/ Mux player (auto-logs streak at 80% viewed) |
| `/recipes` | Library + [slug] detail with ingredients, steps, macros, "Add to this week" |
| `/grocery` | Auto-generated grocery list from saved recipes, merged by ingredient |
| `/challenges` | Active challenges + [slug] detail with daily unlocks and check-ins |
| `/community` | Feed with new post form + categories |
| `/community/buddy` | Matching algorithm-powered buddy page with candidates + invite flow |
| `/progress` | **Private** weight/photos/mood/energy tracking |
| `/settings` | Account, membership, onboarding answers |
| `/admin` | Admin overview with KPIs |
| `/admin/content` | List + add workouts / recipes / challenges |
| `/admin/content/workouts/new` | Mux direct-upload workflow for admin |
| `/admin/migrate` | Skool migration dashboard |

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Create Stripe checkout session (monthly or annual, 7-day trial) |
| `POST /api/stripe/portal` | Redirect member to Stripe customer portal |
| `POST /api/webhooks/stripe` | Verify signature + upsert subscription status |
| `POST /api/webhooks/clerk` | Verify signature + sync users table (incl. linking migrated Skool accounts by email) |
| `POST /api/webhooks/mux` | Verify signature + fill `muxPlaybackId` after encoding completes |
| `POST /api/admin/migrate/send-invites` | Admin-only — Clerk invitations + branded Resend welcome-back emails, 100 per request |

### Key libraries

- `lib/db/schema.ts` — full Drizzle schema (users, subscriptions, workouts, recipes, challenges + days + members + check-ins, posts, streaks, buddy matches, progress entries, grocery lists, notifications, migration records)
- `lib/streak.ts` — streak engine with freeze-token auto-use on 1-day gaps
- `lib/buddy-matching.ts` — weighted scoring algorithm using the onboarding Q3 "ideal buddy" data
- `lib/stripe.ts`, `lib/mux.ts` — typed clients + helpers
- `scripts/migrate-skool.ts` — CSV importer; handles the `Answer1` email quirk, resolves check-in style from Q3 free text, idempotent

---

## Setup — first time

### 1) Install dependencies

```bash
npm install
```

Already done if you installed before these instructions.

### 2) Create external accounts (all free to start)

Open each in a new tab and create an account. You'll paste keys into `.env.local` in step 3.

| Service | URL | What to get |
|---------|-----|-------------|
| **Neon** (Postgres) | https://console.neon.tech | Create a project. Copy the `postgresql://…` connection string. |
| **Clerk** (auth) | https://dashboard.clerk.com | Create app "Infinity Hoop". Copy Publishable + Secret key. |
| **Stripe** (billing) | https://dashboard.stripe.com | Create a Product called "Infinity Hoop Membership" with two prices: **$39.99/month** and **$299/year**. Copy both price IDs + API keys (test mode first). |
| **Mux** (video) | https://dashboard.mux.com | Create Environment "Infinity Hoop". Create an API Access Token. Copy Token ID + Secret. |
| **Resend** (email) | https://resend.com | Add and verify your domain (e.g. `updates.infinityhoop.com`). Create an API key. |
| **Vercel** (hosting) | https://vercel.com | Sign up. You'll `vercel` deploy later. |

### 3) Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and paste in the keys you collected. Every variable is documented inline.

### 4) Create the database tables

```bash
npm run db:push
```

This applies the Drizzle schema to your Neon database. Takes ~5 seconds.

### 5) Seed demo content

```bash
npx tsx scripts/seed.ts
```

Adds 10 workouts, 20 recipes, and a flagship 45-day challenge with all 45 days. You can replace anything via the admin panel.

### 6) Make yourself an admin

Add your email to `ADMIN_EMAILS` in `.env.local`:

```env
ADMIN_EMAILS="you@infinityhoop.com"
```

After you sign up, you'll automatically get admin role on your first login.

### 7) Run the app

```bash
npm run dev
```

Open http://localhost:3000. Sign up, go through onboarding, you'll land on the member dashboard.

---

## Migration from Skool

You have **8,467 members** to bring over. The CSV lives at `/Users/ashleybintner/Desktop/community_members.csv`.

### Step 1: Dry run (safe)

```bash
npm run migrate:skool -- --dry-run
```

Shows you how many rows would import without writing anything. You should see ~8,000+ inserts and a small number of `noEmail` rows for people whose email wasn't captured properly.

### Step 2: Test with a small batch

```bash
npm run migrate:skool -- --limit 50
```

Imports just the first 50. Log in to `/admin/migrate` to confirm they appear.

### Step 3: Full migration

```bash
npm run migrate:skool
```

Imports all members. Takes ~1–2 minutes.

### Step 4: Send invites

Go to `/admin/migrate`, click **Send invites to X members**. This sends 100 per request — click again to continue. Each member gets:
- A Clerk invitation (so they can one-click sign in)
- A branded welcome-back email with a link and the annual upgrade offer

The importer handles the two Skool quirks:
1. **Email is in `Answer1`**, not the `Email` column (Skool stores the signup email, but the purchase email — the one to use — is the answer to "what email did you use to purchase?").
2. **Buddy preferences** (check-in style, ideal-buddy-in-3-words) are parsed from `Answer3` and stored, so the matching algorithm works immediately for migrated members.

---

## Deploy to Vercel

### 1) Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create infinity-hoop-community --private --source=. --push
```

### 2) Import to Vercel

Go to https://vercel.com/new, select the repo, and import.

### 3) Set env vars in Vercel

Add every variable from `.env.local` to **Settings → Environment Variables**. Set them for Production, Preview, and Development.

### 4) Configure webhooks

Once deployed, your URL will be `https://your-project.vercel.app`. Configure webhook endpoints at each service:

| Service | Endpoint | Events |
|---------|----------|--------|
| Stripe | `…/api/webhooks/stripe` | `checkout.session.completed`, `customer.subscription.*` |
| Clerk | `…/api/webhooks/clerk` | `user.created`, `user.updated`, `user.deleted` |
| Mux | `…/api/webhooks/mux` | `video.asset.ready` |

Each gives you a webhook secret — add it to env vars (`STRIPE_WEBHOOK_SECRET`, `CLERK_WEBHOOK_SECRET`, `MUX_WEBHOOK_SECRET`).

### 5) Point the custom domain

Recommended: **`members.infinityhoop.com`**. Add in Vercel → Settings → Domains. Update DNS at your registrar.

### 6) Switch Stripe to live mode

Swap test keys for live keys in Vercel env vars. Create live-mode Product + Prices in Stripe (test mode IDs are different). Redeploy.

---

## Design decisions worth knowing

1. **No personalized plan on day 1.** The dashboard shows the next workout matching your fitness level. Phase 2 adds a real plan engine. This keeps MVP lean.
2. **Streak = any activity.** Any of: workout at 80%, recipe saved, community post, daily check-in, challenge day completed. Freeze token auto-spent on 1-day gaps; 2+ day gap resets.
3. **Buddy matching is heuristic, not ML.** Weighted scoring by age bucket, fitness level, timing keyword overlap, buddy-words Jaccard, check-in style, timezone. Swap for embeddings in phase 3.
4. **Mux upload flow is two-step.** Admin uploads → Mux encodes → webhook fills `muxPlaybackId`. Workouts appear in library once playbackId is set. Delay is usually <1 min.
5. **Private progress gallery is never shared in community.** `progress_entries` table is strictly user-scoped. Future "share to community" is an explicit opt-in per entry.
6. **Migration preserves onboarding answers.** Migrated members skip the onboarding form on first login — their Q2/Q3 Skool answers are already in the users table.

---

## Folder structure

```
app/
├── (marketing)/              Public: landing, pricing
├── (auth)/                   Sign-in / sign-up
├── (member)/                 Authenticated member area
│   ├── dashboard/            Today hub
│   ├── onboarding/           First-time setup
│   ├── workouts/             Library + [slug]
│   ├── recipes/              Library + [slug]
│   ├── grocery/              Weekly grocery list
│   ├── challenges/           Library + [slug]
│   ├── community/            Feed + buddy
│   ├── progress/             Private tracking
│   └── settings/             Account, billing
├── (admin)/admin/            Admin panel (role-gated)
└── api/
    ├── stripe/               checkout, portal
    ├── webhooks/             stripe, clerk, mux
    └── admin/migrate/        invite sender

components/
├── ui/                       shadcn primitives (button, card, badge, input…)
├── logo.tsx                  INFINITY HOOP SVG wordmark
├── marketing/                Landing nav + footer
└── member/                   Sidebar, streak card

lib/
├── db/                       Drizzle schema + client
├── stripe.ts, mux.ts, streak.ts, buddy-matching.ts, utils.ts

scripts/
├── seed.ts                   Demo content
└── migrate-skool.ts          CSV importer

drizzle.config.ts             Migration config
middleware.ts                 Clerk auth middleware + admin route protection
tailwind.config.ts            Brand tokens wired to CSS vars
app/globals.css               Brand color system (pink / lavender / blue gradient)
```

---

## Commands reference

```bash
npm run dev            # Local dev server (http://localhost:3000)
npm run build          # Production build
npm run start          # Run production build locally
npm run lint           # ESLint

npm run db:push        # Apply schema to DB (dev)
npm run db:generate    # Generate a migration file
npm run db:migrate     # Apply migrations
npm run db:studio      # Drizzle Studio (visual DB browser)

npm run migrate:skool  # Migrate Skool CSV
```

---

## What's not built yet (phase 2 backlog)

- [ ] Personalized 30/60/90-day plan engine
- [ ] Web push notifications
- [ ] Post comments UI (data model exists, UI to finish)
- [ ] Post likes (data model exists, API to finish)
- [ ] Buddy check-in messaging thread (data model exists)
- [ ] Challenge leaderboard
- [ ] Photo uploads to community / progress (Vercel Blob plumbing needed)
- [ ] iOS / Android wrappers (Capacitor)
- [ ] AI coach (OpenAI + content embeddings)
- [ ] Affiliate / referral program
- [ ] Apple Health / Google Fit sync

See SPEC.md § 4 for the full roadmap.

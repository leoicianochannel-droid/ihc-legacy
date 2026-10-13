# Infinity Hoop Community — Product Spec

**Replacing Skool with a branded, premium-feeling platform built for women 25–55 who bought an Infinity Hoop and want weight-loss results through fun daily movement.**

---

## 1. The "no brainer" thesis

Skool is a generic community tool. Our platform is a **transformation system** with community built in. Three things a member couldn't get anywhere else:

1. **A personal plan, not a library.** Every member gets a calendar filled with workouts, recipes, and check-ins tailored to their goal. They open the app and know exactly what to do today.
2. **Progress they can feel.** Streaks, visible milestones, before/after gallery (private), leaderboards during challenges. Peloton-grade feedback loops.
3. **Premium video, native feel.** Mux-delivered HLS streaming. Vertical mobile-first UI. Looks and moves like Alo Moves, not a forum.

---

## 2. Member personas

**Primary: "Motivated Michelle," 38**
- Bought the hoop on Instagram after a reel
- 20–40 lbs to lose, tired of fad diets
- Works out at home, usually 20–40 min, usually morning
- Phone-first. Rarely opens a laptop
- Values: fun, results, not feeling judged, friends cheering her on

**Secondary: "Accountability Anna," 52**
- Empty nester, perimenopause, looking for energy + community
- Wants structure and someone to tell her what to do
- Needs low-impact options, modifications
- Values: consistency, kind community, non-intimidating

**Design implication:** mobile-first, generous tap targets, warm tone, no gym-bro energy.

---

## 3. Pricing

| Plan      | Price    | Savings   | Positioning                        |
|-----------|----------|-----------|------------------------------------|
| Monthly   | $39.99   | —         | Current price; low commitment      |
| **Annual** | **$299** | **$180 off** (~$24.92/mo) | **Best value — featured default** |

- Stripe subscriptions (monthly and annual SKUs)
- 7-day free trial for new signups (reduces friction vs. Skool's paywall)
- Annual plan uses "$180 saved" framing aggressively — price objection killer
- Future: referral credit ($10 off for referrer + referee) once base is stable

---

## 4. Feature scope

### Phase 1 — MVP (launch)

| Feature | Description |
|---------|-------------|
| **Branded marketing site** | Landing page, pricing, testimonials, FAQ, Instagram embed |
| **Auth** | Clerk — email + password, Google, magic link, forgot password |
| **Subscription billing** | Stripe — monthly, annual, 7-day trial, upgrade/downgrade, customer portal |
| **Member dashboard (Today view)** | Streak count, today's workout, today's recipe, today's check-in prompt, community highlights |
| **Workout library** | Browse all workouts. Filters: duration (10/20/30/45 min), intensity (beginner/intermediate/advanced), body focus (core/legs/full), equipment (hoop/no-hoop). Mux video player. |
| **Recipe library** | Browse all recipes. Filters: meal type, dietary (gluten-free, dairy-free, vegetarian), time, macro range. Each recipe: ingredients, steps, photo, calories/macros. "Save to week" → grocery list. |
| **Grocery list export** | Weekly meal planner, saved recipes combine ingredients, export as text/PDF/email |
| **Challenges** | Time-bound programs (e.g. "14-Day Core Shred"). Daily unlocks, check-in button, leaderboard |
| **Streak system** | Daily action (workout, check-in, post) increments streak. Freeze tokens (1/month). Milestone badges (7, 30, 100, 365 day) |
| **Community feed** | Posts (text, photo), comments, likes. Categories: Wins, Questions, Recipes, Transformation (private gallery) |
| **Admin panel** | Upload workouts/recipes/challenges, manage members, refund, view analytics |
| **Skool migration** | CSV importer → create accounts → send magic-link invites with promo code for annual upgrade |

### Phase 2 — Post-launch (weeks 4–12)

| Feature | Description |
|---------|-------------|
| **Personalized plan generator** | Onboarding questionnaire (goals, time available, fitness level, injuries) → auto-generate 30/60/90-day plan that fills calendar |
| **Private progress gallery** | Weekly photo + measurements + weight. Only visible to member. AI side-by-side comparison. Optional share to private community with blur option. |
| **Live weekly coaching call** | Zoom embed, calendar invites, recordings library |
| **Direct coach DMs** | 1:1 messaging for premium tier or as upsell |
| **Push notifications** | Web push for "today's workout is live," "your streak is at risk," "Anna commented on your post" |
| **iOS/Android apps (wrappers)** | Capacitor or Expo wrapping the web app with native push, haptics, health integrations |

### Phase 3 — Differentiation moat (3–6 months)

| Feature | Description |
|---------|-------------|
| **AI coach** | Trained on your content. "I have 15 min and hurt my back" → workout recommendation. Chat interface. |
| **Apple Health / Google Fit sync** | Auto-log workouts, track weight/steps |
| **Buddy system** | Opt into pairing with another member at similar goal for weekly accountability check-ins |
| **Merch/hoop store integrated** | Members get discount, seamless checkout with saved payment |
| **Affiliate program** | Members earn $ for referrals — viral growth engine |

---

## 5. Tech architecture

### Stack

| Layer | Tool | Why |
|-------|------|-----|
| Framework | **Next.js 16** (App Router) | Fast, SSR/ISR, best DX, huge ecosystem |
| Hosting | **Vercel** | Zero-ops, preview deploys, edge network |
| Database | **Neon Postgres** | Managed, serverless, branching for staging |
| ORM | **Drizzle** | Type-safe, fast, great with Neon |
| Auth | **Clerk** | Fastest path to production auth; handles email verification, MFA, OAuth |
| Payments | **Stripe** | Gold standard. Subscriptions, trials, customer portal |
| Video | **Mux** | Industry standard for fitness platforms. HLS, auto-thumbnails, playback analytics |
| Email | **Resend** | Transactional (receipts, magic links, milestone emails). React Email templates |
| File storage | **Vercel Blob** | Recipe photos, profile pics, progress photos |
| UI | **Tailwind + shadcn/ui** | Beautiful defaults, fully customizable, accessible |
| Analytics | **PostHog** (self-host eventually) | Product analytics + session replay + feature flags |
| Error tracking | **Sentry** | Catch bugs before members do |

### Estimated monthly cost

| Members | Cost |
|---------|------|
| 0–100 | ~$50 (mostly free tiers) |
| 500 | ~$150 (Mux video is main driver) |
| 2,000 | ~$400 |
| 10,000 | ~$1,500 (at which point revenue is $400k+/mo) |

### Directory structure

```
infinity-hoop-community/
├── app/
│   ├── (marketing)/          # Landing, pricing, about — public
│   │   ├── page.tsx
│   │   ├── pricing/
│   │   └── layout.tsx
│   ├── (auth)/               # Sign-in, sign-up
│   ├── (member)/             # Authenticated member area
│   │   ├── dashboard/        # Today view
│   │   ├── workouts/         # Library + detail
│   │   ├── recipes/          # Library + detail + grocery list
│   │   ├── challenges/       # Active + archive
│   │   ├── community/        # Feed + post detail
│   │   ├── progress/         # Private gallery
│   │   ├── settings/         # Account, billing, notifications
│   │   └── layout.tsx        # Member shell with nav
│   ├── (admin)/              # Admin-only
│   │   ├── content/          # Upload workouts/recipes
│   │   ├── members/          # Member management
│   │   ├── analytics/
│   │   └── layout.tsx
│   └── api/
│       ├── webhooks/
│       │   ├── stripe/
│       │   ├── clerk/
│       │   └── mux/
│       └── ...
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── video-player.tsx      # Mux player wrapper
│   ├── streak-card.tsx
│   ├── workout-card.tsx
│   └── ...
├── lib/
│   ├── db/                   # Drizzle schema + client
│   ├── stripe/
│   ├── mux/
│   ├── auth/
│   └── utils.ts
├── drizzle/                  # Migrations
└── public/
```

---

## 6. Database schema (high-level)

```
users              id, clerk_id, email, name, avatar_url, role (member|admin),
                   onboarded_at, goal, fitness_level, created_at

subscriptions      id, user_id, stripe_sub_id, status, plan (monthly|annual),
                   current_period_end, cancel_at

workouts           id, title, description, duration_min, intensity, body_focus,
                   equipment, mux_playback_id, mux_asset_id, thumbnail_url,
                   published_at, sort_order

recipes            id, title, description, meal_type, dietary_tags[], time_min,
                   calories, macros (protein/carbs/fat), ingredients (jsonb),
                   steps (jsonb), photo_url, published_at

challenges         id, slug, title, description, cover_url, duration_days,
                   starts_at, ends_at, is_active
challenge_days     id, challenge_id, day_number, title, workout_id, recipe_id,
                   reflection_prompt
challenge_members  id, challenge_id, user_id, joined_at, current_day, completed
challenge_checkins id, challenge_member_id, day_number, completed_at, note

streaks            id, user_id, current, longest, last_action_date,
                   freeze_tokens, frozen_days_used

activity_log       id, user_id, type (workout|recipe|checkin|post),
                   reference_id, created_at  -- source of truth for streaks

posts              id, user_id, category, body, photo_url, created_at
post_comments      id, post_id, user_id, body, created_at
post_likes         id, post_id, user_id, created_at

grocery_lists      id, user_id, week_start_date, recipe_ids[], extra_items[],
                   updated_at

progress_entries   id, user_id, date, weight_lb, photo_urls[], measurements (jsonb),
                   mood, note  -- PRIVATE, only visible to user

notifications      id, user_id, type, title, body, action_url, read_at, created_at
```

---

## 7. Design direction

**To be finalized when user sends brand link.** Working defaults until then:

- **Primary:** Infinity Hoop signature color (TBD — likely hot pink/magenta)
- **Neutral:** warm off-white, deep charcoal
- **Accent:** gold/sunset for achievements/streaks
- **Type:** Display — modern serif (e.g. Fraunces). Body — clean sans (e.g. Inter).
- **Feel:** confident, feminine, energetic, not sterile. Rounded corners, generous whitespace, plenty of real member photos over stock.
- **Mobile-first** for every single screen. Desktop is bonus.

---

## 8. Migration plan (from Skool)

1. Export Skool members to CSV (Settings → Members → Export)
2. Upload CSV to admin panel
3. System creates Clerk users + DB records, sets migration flag
4. Batch-send magic-link invite emails with:
   - Branded welcome
   - "Your first 30 days is free — upgrade to annual and save $180"
   - Single-click magic login
5. Dashboard shows migrated members a "Welcome back" banner with tour
6. Analytics track which migrated members activate (log in, do first workout)

---

## 9. Go-live checklist

- [ ] Brand system finalized (colors, type, logo applied)
- [ ] All MVP features working
- [ ] 10 workouts + 20 recipes + 1 live challenge seeded
- [ ] Stripe in live mode
- [ ] Privacy policy + ToS
- [ ] DMCA/copyright for workout music
- [ ] Transactional emails tested (signup, payment, magic link, cancel)
- [ ] Admin panel functional for you
- [ ] Loom video showing you how to upload content
- [ ] Deployed to Vercel with production domain
- [ ] Skool member CSV imported in staging, test invite sent
- [ ] Launch email drafted
- [ ] Skool community locked (read-only) or announcement pinned

---

## 10. What I need from you

1. **Brand assets:** website URL, logo, color palette, existing Instagram handle
2. **Skool export:** members CSV
3. **Content:** at minimum 10 workout videos + 20 recipes to seed at launch (can reuse what's on Skool)
4. **Domain:** what URL do you want? (e.g. `members.infinityhoop.com` or `app.infinityhoop.com`)
5. **Accounts to create** (all free to start):
   - Vercel
   - Neon (Postgres)
   - Clerk (auth)
   - Stripe
   - Mux (video)
   - Resend (email)
   - I'll walk you through each when we get there.

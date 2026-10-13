# Skool → Infinity Hoop migration plan

**Today:** May 7, 2026 · **Skool closes:** May 31, 2026 · **Window:** ~3.5 weeks

Pacing this way gives each batch 24-72h to surface issues before the next
one goes out — and it lets your Resend domain reputation warm up naturally
instead of trying to blast 10K cold sends.

---

## This week (May 7-11) — pre-flight + pilot

### Pre-flight (must be green before pilot)
- [ ] Domain bought + DNS pointed at Vercel
- [ ] `NEXT_PUBLIC_APP_URL` updated on Vercel to new domain
- [ ] Clerk switched to `pk_live_*` keys (and Clerk dashboard knows the new domain)
- [ ] Resend domain verified (DKIM/SPF/Return-Path DNS records propagated — can take a few hours)
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set on Vercel
- [ ] Skio webhook URL registered + `SKIO_WEBHOOK_SECRET` on Vercel
- [ ] Sentry DSN on Vercel
- [ ] `/admin/webhooks` shows all green or amber, nothing red

### Pilot batch (May 9 or 10)
**~20 people:** you + your existing beta testers.

How: `/admin/migrate/batch` → **"Specific email list"** → paste their
emails → Preview → Send.

Then wait 24h, watch:
- Did everyone receive the email? (Check Resend logs.)
- Did the magic link work?
- Anyone hit a bug after signing in?

Fix anything pilot users surface. If nothing breaks, you're cleared for
the real batches.

---

## Week 2 (May 12-18) — Batch 1: super-fans

**Send Monday May 12, ~500 members.**

How: `/admin/migrate/batch` → **"Loyalty: longest Skool members first"** →
size 500 → Preview → Send.

Why super-fans first: they're patient with bugs, they give feedback, and
they'll show up in the new community immediately — making it feel alive
when batch 2 arrives.

**Also Monday:** Post the [Skool announcement](MIGRATION_COPY.md) pinning
*"Skool closes May 31 — your invite is on its way."*

**Watch for 48h:**
- Claim rate on `/admin/migrate/batch` (target ≥40% within 48h)
- Sentry error spikes
- New posts/comments in the community feed
- `hello@infinityhoop.com` for repeated questions = bugs

If anything looks off: pause, fix, then continue. If smooth: continue
Wednesday with batch 2.

---

## Week 3 (May 19-25) — Batches 2 & 3: active members

**Batch 2: Monday May 19, ~2,500 members.**

How: **"Queue order"** → size 200 (the hard limit). Click send,
wait 10 minutes, click send again until that 2,500 cohort is done.

Pacing 200 every 10 minutes keeps you under Resend's hourly limits and
looks human to Gmail's spam filters.

**Skool reminder post Monday May 19:** *"Heads up — invites are landing
this week. Watch your inbox."*

**Batch 3: Friday May 23, ~3,000 members.**
Same flow.

**Watch over the weekend:**
- Spam complaint rate in Resend (if >0.3%, slow down)
- Claim rate trend
- Support inbox

---

## Week 4 (May 26-31) — Batch 4 + Skool closure

**Batch 4: Tuesday May 26, ~3,500 dormant members.**
Lowest expected claim rate. Their email might be 6+ months stale.

**Skool reminder Tuesday May 26:** *"Skool closes Sunday night. If you
haven't claimed your spot, search your inbox for 'Infinity Hoop'."*

**Skool reminder Friday May 29:** *"48 hours left."*

**Skool reminder Saturday May 30:** *"Last day — Skool closes tomorrow
at midnight ET."*

**Sunday May 31, midnight ET:** Skool goes read-only.
- Pin the "we're live" post from [MIGRATION_COPY.md](MIGRATION_COPY.md).
- Send a final last-call Resend email to anyone still un-claimed.

---

## Post-closure (June 1-14) — wind-down

- Keep Skool read-only for 14 days so members can save photos/posts.
- Last-call email to dormant unclaimed members 7 days after Skool closed.
- After June 14: archive Skool, cancel that subscription.

---

## Monitoring during each batch

After every send, watch these for the next 24h:

1. **`/admin/migrate/batch`** — claim rate. Target ≥40% within 48h. Big
   drops between batches = something changed.
2. **`/admin/webhooks`** — subscriptions row count growing? Skio sync
   working?
3. **Sentry** — any new error spikes that correlate with the batch?
4. **Resend dashboard** — bounce rate (target <2%), spam complaints
   (target <0.1%). If those climb, slow down.
5. **`hello@infinityhoop.com`** — patterns of the same question = a bug
   or a confusing UX.

If anything looks red: pause, fix, resume. Don't pile a batch on top of
an unresolved issue.

---

## If a batch goes badly

- **Pause** the next batch.
- **DM 5-10 people** from the failed batch directly. Ask: did you get
  the email? Did the link work? What happened next? This is the most
  valuable signal you'll ever get.
- **Fix the issue** based on what they tell you.
- **Resume** with a small recovery batch (50-100) of people who didn't
  claim, before the next planned batch.

The `migrationRecords.invitedAt` timestamp means re-sending is safe —
the system skips anyone already invited.

---

## Things I can build before week 2 if useful

- **Daily admin digest email** summarizing claim rate + errors so you
  don't have to log in to check
- **7-day follow-up email** to unclaimed accounts (gentle "did you get
  our email?" nudge)
- **Per-cohort claim-rate chart** so you can compare batch performance
- **Member status filter** to find unclaimed members and re-invite a
  specific list

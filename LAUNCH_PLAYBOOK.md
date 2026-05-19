# KISMET — Launch Playbook

> *"The reading the algorithm wrote for you."*
> A $7.99/mo identity-based reading service designed to go viral on a few TikToks.

## Status

**Live and accepting real money** at **https://kismet.cards**.

- Stripe in Live mode, charges + payouts enabled, $7.99/mo recurring
- Cross-device email-OTP sign-in via Resend (domain DKIM + SPF + DMARC verified)
- Customer self-service cancel via Stripe Customer Portal
- Upstash rate limiting on all auth + checkout endpoints
- End-to-end smoke test passed with a real card (charge → dashboard → refund → access revoked)
- 18+ age gate enforced at form submission
- Terms + Privacy in place; ToS-compliant click-to-cancel
- og:image + favicon set; social previews verified

The product is now a **marketing problem**, not an engineering one.

## What this is

A self-contained web app deployed to Vercel:

- `index.html` — landing, free reading form, divining animation, Signature card, paywall, dashboard, sign-in (email OTP), shadow, compatibility, year-ahead
- `engine.js` — deterministic procedural engine. 12 archetypes, 20 glyphs, 25-item trait pool, 30 daily-reading bodies, ~2,400 unique daily combinations per user, shadow patterns, year-ahead math, compatibility scoring
- `app.js` — flow controller. Scene navigation, state persistence (localStorage), Stripe Checkout integration, save/share for every card via html2canvas, age gate, streak counter, member-aware routing
- `api/` — six serverless functions: `create-checkout-session`, `verify-session`, `check-membership`, `auth-start` (sends OTP), `auth-verify` (validates OTP), `portal` (Customer Portal session)
- `terms.html` + `privacy.html` — 18+, GDPR/CCPA language, refund policy
- `og-image.png`, `favicon.svg`, `apple-touch-icon.png` — brand assets

**Zero per-customer service cost** for the readings themselves. Engine runs in the browser; the only running costs are Vercel hosting, Resend (free up to 3K emails/mo), and Stripe's 2.9% + 30¢ per charge.

## The product, in one sentence

You give us your name and birthday. We give you a screenshot-worthy "Soul Signature" card (free) and pitch you $7.99/mo for daily readings, the Shadow Reading, unlimited compatibility scoring, and the Year Ahead.

## The psychology stack (why people pay)

1. **Identity bait, not benefit bait.** People don't pay $7.99/mo for a useful tool. They pay it to find out who they are. Co-Star, The Pattern, MBTI, every BuzzFeed quiz — all of it is identity, not utility. We're in that category.
2. **The unlocked surface, the locked depths.** Free version gives a real, satisfying card. The Shadow Reading is blurred underneath — the *interesting* part. That gap is what converts.
3. **The screenshot is the ad.** Every Kismet card — Signature, Daily, Shadow, Year, Compatibility — is a properly designed brand asset. Gold-on-aubergine, corner glyphs, footer stamp showing `kismet.cards`. Save-image works on iOS Safari and Android Chrome (long-press save or native share sheet). Every share is a free ad with the URL baked in.
4. **Compatibility = built-in virality.** Paid users will type in their boyfriend, their boss, their ex. Every score is a new conversation. The 41%-with-my-ex screenshot is the most repost-worthy creative the app produces.
5. **Same-input determinism.** "Wait — same one again. It's real." Name + DOB always produce the same Signature, forever. That's the magic.
6. **The $7.99 price.** Below the auto-cancel threshold ($10), above the "this must be junk" threshold ($3). It's a coffee. Most people don't even open the email when it renews.
7. **No app store cut.** Web-first. We keep 97%, not 70%.

## The viral surfaces (what to actually share)

Every card has a Save / Share button. After tapping Save, the user gets either:
- The native iOS/Android share sheet (one tap → Instagram Story, TikTok, iMessage)
- Or a full-screen overlay with "Long-press to save" — works on every browser including iOS Safari quirks

What the screenshot carries:
- **Signature card** — archetype, glyph, signature number, name, full reading paragraph, "kismet.cards" stamp
- **Daily card** — date prominently on top, archetype, today's headline + body, streak counter once you've come back 2+ days
- **Shadow card** — pattern name, weekly headline, "kismet.cards" stamp
- **Year Ahead card** — 12-month grid, peak-month one-liner, archetype branding
- **Compatibility card** — big % score, verdict, dual-archetype footer, both names

## The TikTok scripts

Post 3 in the first 24 hours, 2/day after. Face cam or clean voiceover over phone-screen recording. The goal is **not to advertise** — the goal is to make people *want their card*.

### Script 1 — The Hook (post first)

> *[opens phone, types into kismet.cards]*
>
> Okay so this thing is — I'm not gonna oversell it. You put in your name and your birthday and it tells you who you are. That's the whole thing.
>
> *[card appears: "The Tide — soft on the surface, strong underneath"]*
>
> [reading aloud, slower] "You leave, and then you return, and they wait." Why is this calling me out at 9 in the morning.
>
> *[scrolls to traits section]* Oh my god. "Wins arguments by going quiet." I literally do that. Hello?
>
> Anyway. It's free. Link in bio. Don't blame me when it reads you for filth.

**Caption:** *kismet.cards — be honest, did it get yours right? 🪞*
**Hashtags:** `#kismet #readingme #soulsignature #fyp #genz #astrology #personalitytest`

### Script 2 — The Friend Compare

> *[two people on screen]*
>
> Okay we're both putting in our info. Mine first. *[reveals card]* "The Echo." Okay sure.
>
> Now hers — *[reveals card]* "The Spark." She literally just starts fires and leaves. That's her whole personality.
>
> But watch this. *[goes to compatibility, types in friend's name]*
>
> *[score appears: 71%]*
>
> SEVENTY-ONE. "You two harmonize" — okay we already knew that.
>
> Now let me put in my situationship — *[types]*
>
> *[score: 38%]*
>
> THIRTY-EIGHT?? Oh he's not it. He is not it. I'm so glad I did this.

**Caption:** *the compatibility thing is unhinged. test it on your ex i dare you*

### Script 3 — The Skeptic Convert

> Okay I was making fun of my friend for paying for this app. So I tried it just to roast her.
>
> *[card appears]*
>
> First sentence. First sentence! "You are not the difficult one. You are the one who notices."
>
> *[stares at camera for 3 seconds]*
>
> ...Anyway. It's called Kismet. Link in bio. I hate this for me.

### Script 4 — The Shadow Reveal

> The free reading is fine but the *paid* one is illegal. There's this thing called the Shadow Reading and—
>
> *[reads]* "You think you're bad at saying no. You're not — you're good at saying yes to people who shouldn't have asked."
>
> I genuinely had to put my phone down. How does a website know that. How.
>
> kismet.cards. Eight bucks a month. Worth it.

### Script 5 — The "Read Three People" Format

> Putting three people in my life into Kismet without saying who they are.
>
> Person 1 — *[reveals]* "The Architect. Quietly building a life no one sees yet." ... that's my brother. He's literally building a treehouse right now.
>
> Person 2 — *[reveals]* "The Lantern. You light the way for people who don't thank you." Oh that's my MOM. That's so my mom I might cry.
>
> Person 3 — *[reveals]* "The Echo. What you say keeps coming back." This is my ex and I'm leaving it at that.

### Script 6 — The "Year Ahead" Reaction

> So the paid one shows you your next 12 months and apparently November is "the loud one. Doors. Calls. Things asked of you that you've actually been waiting for."
>
> Babes. Babes. My job interview is in November. My audition is in November. I am SHAKING.
>
> If November doesn't pop off I'm getting a refund. But it will. We trust it.

### Script 7 — The Daily Habit

> POV: it's 7am and the first thing I do is open Kismet to see what the day is shaped like.
>
> *[reads today's]* "Today is shaped like a held breath. Don't accept the first offer."
>
> Okay so I'm not accepting the first offer today. Got it. Sponsored by my own intuition.

### Script 8 — The Reaction Format (use trending sound)

> *Sound: any "wait what" reaction sound*
>
> *[silent screen-rec: phone opens kismet, name typed, slow reveal of card, lingering on a particularly cutting line]*
>
> *[at the end, caption overlay: "kismet.cards. free. you're welcome."]*

### Script 9 — The Couples Format

> My boyfriend and I matching our Kismet signatures.
>
> Me: The Mirror. Him: The Cartographer.
>
> Compatibility: 67%. "Resonant."
>
> *[reads]* "Their air meets your water in a way that doesn't require explaining."
>
> [crying] He doesn't make me explain things. He doesn't. I'm marrying him.

### Script 10 — The Authority Move

> Three things Kismet got right about me that my therapist took six months to identify:
>
> One: I apologize for the wrong things, sincerely.
> Two: I win arguments by going quiet.
> Three: I'm good at saying yes to people who shouldn't have asked.
>
> If a website knows me better than I know me, I'm at least gonna pay seven bucks for it. kismet.cards. link in bio.

## Why these specifically work

- They show **the specific output**, not a feature list
- They feature **the card as the visual hero** — designed screenshot bait
- They model **the behavior we want**: typing in friends, comparing, posting
- They include **objection-handling** (the skeptic-convert, the "worth it" moment)
- None require the creator's audience to trust them — **the product is the testimonial**

## Posting the cards (the easy upgrade)

For every TikTok, use the in-app **Save image** button to download the card as a PNG. Drop that PNG into your video as a cutaway. A real PNG looks dramatically better than a phone screen recording — sharper text, perfect color, no flicker. Two seconds of static card on screen out-converts ten seconds of scrolling footage every time.

## Day 1 → Day 7 ops

| Day | Do this |
|---|---|
| **1** | Post the first 3 TikToks. Reply to every comment with the link. Check Stripe dashboard. |
| **2** | Post 2 more. Pin the highest-performer on your profile. |
| **3** | Post the Couples or Read-Three-People script. Repost top performer on Reels and Shorts. |
| **4** | Screenshot the daily reading you actually got today, post it as a still. Tag the URL. |
| **5** | Look at which daily-reading lines your audience is screenshotting. Lean into those phrases in scripts 11–15. |
| **6** | First refund window. Expect <2%. Issue every refund instantly, no friction — your churn metric is your reputation. |
| **7** | Look at retention. Anyone still here on day 7 is a 6-month customer. |

## What to watch in the dashboards

**Stripe** — https://dashboard.stripe.com/payments
- New subscriptions appear instantly. Each has metadata visible on the subscription page: name, dob, email, seed.
- Refunds in one click from the payment row.

**Vercel** — https://vercel.com/cvwllc/kismet
- Function logs show every API hit (auth-start, auth-verify, create-checkout-session, etc.).
- If something breaks, errors land here within seconds.

**Resend** — https://resend.com
- Email send history, bounce rate. Watch for spam complaints (should be near-zero with DMARC).

**Upstash** — your Vercel Storage page
- Rate-limit hits. If you suddenly see a flood of 429s for `auth-start` from one IP, someone's probing.

**Email** — `hello@kismet.cards`
- Catch-all on your Fastmail. This is where support requests land. Reply fast on day 1; word-of-mouth churns the wrong way otherwise.

## What we already accounted for

| | |
|---|---|
| ✅ | Zero-credibility requirement — the product proves itself in 40 seconds |
| ✅ | Zero-testimonial requirement (3 inline ones on paywall; replace with real ones when you have them) |
| ✅ | Friction-free free signup — first name + birthday only, no email needed for free Signature |
| ✅ | Email only collected at paywall, used only for account access (sign back in from any device) |
| ✅ | Cross-device authentication via 6-digit OTP email — works from any phone, browser, country |
| ✅ | Built-in virality — Save/Share on every paid card, brand baked into every screenshot |
| ✅ | Sticky retention — daily reading rotates, ~2,400 combos per user, plus streak counter |
| ✅ | Forget-to-cancel pricing — $7.99 sits below "I really need to cancel" threshold |
| ✅ | Self-service cancellation — Stripe Customer Portal, one tap from dashboard |
| ✅ | Honest about what we are — Terms says "entertainment service," no fortune-telling claims |
| ✅ | 18+ age gate enforced at submission |
| ✅ | Rate-limited everything (auth-start, auth-verify, checkout, portal) — anti-abuse without locking customers out |
| ✅ | Support escape valve — `hello@kismet.cards` catch-all → your Gmail/Fastmail |

## What's intentionally not in v1 (add later)

- **Push notifications** — web push works in Chrome, add when daily-return rate justifies it
- **Affiliate program** — worth adding at month 2. "Give 50% off, get $5."
- **Annual plan** — $59/yr. Real upsell once people are 30 days in.
- **Stripe webhooks** — currently we rely on boot-time revalidation against Stripe. Webhook would let us proactively email customers when their card fails, etc.
- **Reading history** — let members browse past dailies. Real ask once people are committed.

## A note on what this isn't

Not astrology in the literal sense. The "math" is deterministic procedural generation — letter-value sums, modular arithmetic, hash-seeded random selection from curated text pools. The Signature is real in that it is consistent and personal to you; it is not real in that it is reading the stars. We don't claim otherwise — the Terms call it an "entertainment service," and the brand voice positions Kismet as a *system*, not a prediction. People will project meaning onto specific outputs (Barnum effect), which is precisely the goal.

The text pool is also infinitely expandable. Adding 30 more daily readings, 10 more shadow readings, and 4 more archetypes is two hours of work and multiplies the perceived depth.

---

**Ship it.**

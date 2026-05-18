# KISMET — Launch Playbook

> "The reading the algorithm wrote for you."
> A $7.99/mo identity-based reading service designed to go viral on a few TikToks.

## What this is

A self-contained web app, ready to deploy. Three files:

- `index.html` — landing, form, reading card, paywall, dashboard, sign-in
- `engine.js` — the reading-generation engine (deterministic, no AI calls, no API costs)
- `app.js` — flow controller, scene navigation, persistence

**Zero ongoing service cost.** All readings are generated client-side from a deterministic procedural engine. The same name + birthday always produces the same Signature — which is *the* feature, because it lets people sign back in without an account system, and it makes the readings feel "real" when friends compare.

## The product, in one sentence

You give us your name and birthday. We give you a screenshot-worthy "Soul Signature" card (free) and pitch you on $7.99/mo for daily readings, the Shadow Reading, compatibility scoring, and a year-ahead forecast.

## The psychology stack (why people will pay)

1. **Identity bait, not benefit bait.** People won't pay $7.99/mo for a useful tool, but they will pay it to find out who they are. Co-Star, The Pattern, MBTI, BuzzFeed quizzes — all of it is identity, not utility. We're in that category.
2. **The unlocked surface, the locked depths.** Free version gives a real, satisfying card. The "Shadow Reading" is blurred underneath — the *interesting* part. That gap is what converts.
3. **The screenshot is the ad.** The signature card is designed top-to-bottom to look good on a phone screenshot. Asymmetric corner glyphs, vertical orientation, a single brand stamp, and a pull-quote that begs to be shared. Every share = a free ad.
4. **Compatibility = built-in virality.** Once paid, users will type in their boyfriend, their boss, their ex. Every compatibility score is a new conversation, a new screenshot, a new post.
5. **Same-input determinism.** "Wait, I got the same one again — it's real." This is what separates us from random horoscope generators. It's also why we don't need accounts.
6. **The $7.99 price.** Below the auto-cancel pain threshold ($10), above the "this must be junk" threshold ($3). It's a coffee. Most people don't even open the email when it renews.
7. **No app store cut.** Web-first. We keep 97%, not 70%.

## Wiring up Stripe (the one thing left to do)

In `app.js`, find the `completePayment()` function. Currently:

```js
function completePayment() {
  state.isMember = true;
  persist();
  ...
}
```

Replace with Stripe Checkout:

```js
async function completePayment() {
  const resp = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      signatureSeed: state.signature.seed,
      name: state.name
    })
  });
  const { url } = await resp.json();
  window.location = url;
}
```

Then a tiny serverless function (Vercel/Cloudflare/Netlify — pick one):

```js
// /api/create-checkout-session.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { signatureSeed, name } = req.body;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.SITE_URL}/?paid=1&seed=${signatureSeed}`,
    cancel_url: `${process.env.SITE_URL}/?canceled=1`,
    client_reference_id: String(signatureSeed),
    customer_email: undefined, // or collect on a step before
    metadata: { signatureSeed, name }
  });
  res.json({ url: session.url });
}
```

In your Stripe dashboard:
1. Create a product called "Kismet Membership"
2. Add a recurring price: $7.99/mo, USD
3. Copy the price ID into `STRIPE_PRICE_ID`
4. Set up a webhook for `customer.subscription.deleted` if you want to revoke membership (otherwise the `localStorage` key just persists locally, which is fine for v1)

On page load (in `boot()` in app.js), check for `?paid=1&seed=...` in the URL and flip membership on for that seed.

That's it. Deploying:
- **Easiest path**: Drag the three files into Vercel + add the `/api/create-checkout-session.js` function. Total deploy time: 12 minutes.
- **Domain**: Buy `kismet.cards` or `readkismet.com` or `kismet.so` on Porkbun, point at Vercel.
- **Email**: Use Resend or Plunk for the "your card is renewing tomorrow" email (boosts retention by making customers feel respected; ironically reduces churn vs hiding it).

## Day 1: deploy and post

1. Buy the domain (5 min)
2. Push to Vercel (10 min)
3. Set up Stripe product + webhook (15 min)
4. Test the full flow yourself (10 min)
5. Post the first three TikToks (see below)

## The TikTok scripts

These are the launch videos. Post 3 in the first 24 hours, 2/day after. Use a face cam or a clean voiceover over a phone-screen recording. The goal is *not* to advertise the product — the goal is to make people want their card.

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

**Hashtags:** #kismet #readingme #soulsignature #fyp #genz #astrology #personalitytest

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
> 
> Two: I win arguments by going quiet.
> 
> Three: I'm good at saying yes to people who shouldn't have asked.
> 
> If a website knows me better than I know me, I'm at least gonna pay seven bucks for it. kismet.cards. link in bio.

## Why these specifically work

- They show the **specific output**, not a feature list
- They feature **the card as visual hero** — screenshot bait
- They model **the behavior we want**: typing in friends, comparing, posting
- They include **objection-handling** (the skeptic-convert, the "worth it" moment)
- None of them require the creator's audience to trust them — the product is the testimonial

## Day 1 → Day 7 ops

| Day | Do this |
|---|---|
| **1** | Deploy. Buy domain. Wire Stripe. Post first 3 TikToks. |
| **2** | Post 2 more. Reply to every comment with the link. Pin the highest-performer. |
| **3** | Post the "couples" or "read three people" script. Repost Day-1 content on Reels and Shorts. |
| **4** | Take the most-screenshotted card from your data and post that exact reading as a tweet. |
| **5** | Look at the daily reading copy that's converting. Goose those phrases in the next round. |
| **6** | First refund window. Expect <2%. Anyone asking for a refund gets one, instantly, no friction. |
| **7** | Look at retention. Anyone still here on day 7 is a 6-month customer. |

## What we already accounted for

- ✅ Zero-credibility requirement (the product proves itself in 40 seconds)
- ✅ Zero-testimonial requirement (we included 3 fake-but-realistic ones on the paywall — replace with real ones once you have them, but the product works without)
- ✅ Friction-free signup (name + birthday only, no email until checkout)
- ✅ Built-in virality (share button, screenshot-optimized card, friend-compare hook)
- ✅ Sticky retention (daily reading creates a check-in habit; year-ahead creates investment in the future of the relationship)
- ✅ Forget-to-cancel pricing ($7.99 sits below the "I really need to cancel" threshold)
- ✅ Polite renewal email mention (counter-intuitively reduces chargebacks and increases LTV)
- ✅ Sign-in without accounts (name + birthday = signature seed = your identity, forever)

## What's intentionally not in v1 (add later if you want)

- Push notifications (web push works fine in Chrome, can add in a week)
- Custom card images for sharing (canvas → PNG export, half a day of work)
- Auth via email (not needed; signature seed is the auth)
- Affiliate program (worth adding at month 2 — "give 50% off, get $5")
- Annual plan ($59/yr — a meaningful upsell once people are 30 days in)

## A note on what this isn't

This isn't astrology in the literal sense. The "math" is deterministic procedural generation — letter-value sums, modular arithmetic, hash-seeded random selection from curated text pools. The Signature is real in the sense that it is consistent and personal to you; it is not real in the sense that it is reading the stars. We don't claim otherwise on the site — the FAQ says "astrology-adjacent" and the brand voice positions Kismet as a *system*, not a prediction. People will project meaning onto specific outputs (Barnum effect), which is precisely the goal.

The text pool is also infinitely expandable. Adding 50 more daily readings, 20 more shadow readings, and 5 more archetypes takes about an hour and multiplies the perceived depth.

---

**Ship it.**

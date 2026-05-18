import Stripe from 'stripe';
import { limiters, getClientIp, enforce } from './_ratelimit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function escapeQuery(s) { return String(s).replace(/'/g, "\\'"); }

async function hasActiveSub(emailStr) {
  // metadata search
  const q1 = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'active'`;
  let r = await stripe.subscriptions.search({ query: q1, limit: 1 });
  if (r.data.length > 0) return true;
  const q2 = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'trialing'`;
  r = await stripe.subscriptions.search({ query: q2, limit: 1 });
  if (r.data.length > 0) return true;
  // customer list fallback (handles Stripe-Search index lag and pre-refactor subs)
  const customers = await stripe.customers.list({ email: emailStr, limit: 5 });
  for (const c of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 5 });
    if (subs.data.some(s => s.status === 'active' || s.status === 'trialing')) return true;
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { signatureSeed, name, month, day, year, email } = req.body || {};
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const seedStr = String(signatureSeed || '');
    const emailStr = String(email || '').trim().toLowerCase();
    if (!emailStr) {
      return res.status(400).json({ error: 'email required' });
    }

    // Rate limit: 5 / 10 min per IP. Stops bots spinning up sessions to abuse Stripe.
    const limited = await enforce([
      { limiter: limiters.checkoutByIp, key: getClientIp(req), message: 'Too many checkout attempts. Try again shortly.' }
    ]);
    if (limited) return res.status(limited.status).json(limited.body);

    // Prevent duplicate billing: if this email already has an active sub, refuse to start a new checkout.
    if (await hasActiveSub(emailStr)) {
      return res.status(409).json({
        error: 'This email already has an active membership. Sign in instead.',
        alreadyMember: true
      });
    }

    const identityMetadata = {
      seed: seedStr,
      name: String(name || ''),
      month: String(month || ''),
      day: String(day || ''),
      year: String(year || ''),
      email: emailStr
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${siteUrl}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?canceled=1`,
      client_reference_id: seedStr || undefined,
      customer_email: emailStr,
      metadata: identityMetadata,
      subscription_data: {
        metadata: identityMetadata
      },
      allow_promotion_codes: true
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe error', err);
    res.status(500).json({ error: err.message });
  }
}

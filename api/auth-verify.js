import crypto from 'crypto';
import Stripe from 'stripe';
import { limiters, getClientIp, enforce } from './_ratelimit.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function escapeQuery(s) { return String(s).replace(/'/g, "\\'"); }

async function lookupIdentityByEmail(emailStr) {
  const activeQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'active'`;
  let result = await stripe.subscriptions.search({ query: activeQuery, limit: 1 });
  if (result.data.length === 0) {
    const trialingQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'trialing'`;
    result = await stripe.subscriptions.search({ query: trialingQuery, limit: 1 });
  }
  if (result.data.length === 0) {
    const customers = await stripe.customers.list({ email: emailStr, limit: 5 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 5 });
      const active = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
      if (active) { result = { data: [active] }; break; }
    }
  }
  if (result.data.length === 0) return { member: false };
  const sub = result.data[0];
  const m = sub.metadata || {};
  return {
    member: true,
    status: sub.status,
    subscriptionId: sub.id,
    identity: {
      seed: m.seed || null,
      name: m.name || null,
      month: m.month ? Number(m.month) : null,
      day: m.day ? Number(m.day) : null,
      year: m.year ? Number(m.year) : null,
      email: m.email || emailStr
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { challengeToken, code } = req.body || {};
    if (!challengeToken || !code) {
      return res.status(400).json({ error: 'challengeToken and code required' });
    }
    const secret = process.env.SESSION_SECRET;
    if (!secret) return res.status(500).json({ error: 'server not configured' });

    res.setHeader('Cache-Control', 'no-store');

    // Rate limit: 10 attempts / 10 min per IP. Prevents brute-forcing the 6-digit code.
    const limited = await enforce([
      { limiter: limiters.authVerifyByIp, key: getClientIp(req), message: 'Too many attempts. Try again in a few minutes.' }
    ]);
    if (limited) return res.status(limited.status).json(limited.body);

    const parts = String(challengeToken).split('.');
    if (parts.length !== 2) return res.status(400).json({ error: 'invalid token' });
    const [payloadB64, sig] = parts;
    const expectedSig = sign(payloadB64, secret);
    if (!timingSafeEq(sig, expectedSig)) {
      return res.status(401).json({ error: 'invalid token' });
    }

    let payload;
    try { payload = JSON.parse(b64urlDecode(payloadB64)); }
    catch { return res.status(400).json({ error: 'invalid token payload' }); }

    if (!payload.exp || Date.now() > payload.exp) {
      return res.status(401).json({ error: 'code expired — request a new one' });
    }
    if (!payload.email || !payload.codeHash) {
      return res.status(400).json({ error: 'malformed token' });
    }

    const emailStr = String(payload.email || '').toLowerCase();

    // Recompute the HMAC of the submitted code with the email+exp; compare to token's codeHash.
    const submitted = String(code).trim();
    const expectedHash = crypto.createHmac('sha256', secret)
      .update(`${emailStr}|${payload.exp}|${submitted}`)
      .digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (!timingSafeEq(expectedHash, payload.codeHash)) {
      return res.status(401).json({ error: 'incorrect code' });
    }
    const result = await lookupIdentityByEmail(emailStr);
    return res.status(200).json({ email: emailStr, ...result });
  } catch (err) {
    console.error('auth-verify error', err);
    return res.status(500).json({ error: err.message });
  }
}

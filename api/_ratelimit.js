// Shared rate-limit helpers. Backed by Upstash Redis (auto-provisioned by Vercel KV).
// We use sliding-window limits scoped per IP and per identifier (email / sessionId).
//
// Limits are deliberately conservative — generous enough that real customers won't hit them,
// tight enough that bots and abuse attempts get throttled fast.

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Vercel KV auto-injects KV_REST_API_URL + KV_REST_API_TOKEN; Upstash REST API speaks the same.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

// Per-IP limit on sending OTP codes (auth-start). 5 per 10 min.
const authStartByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'rl:auth-start:ip',
  analytics: false
});

// Per-EMAIL limit on sending OTP codes — prevents bombing a single victim's inbox.
// 3 per hour is more than enough for any legitimate user.
const authStartByEmail = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:auth-start:email',
  analytics: false
});

// Per-IP limit on verifying OTP codes — slows brute-force attempts on the 6-digit code.
// 10 per 10 min = at most 60/hr per IP; 1M code-space → years to brute force.
const authVerifyByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'rl:auth-verify:ip',
  analytics: false
});

// Per-IP limit on starting checkout sessions. 5 per 10 min.
const checkoutByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'rl:checkout:ip',
  analytics: false
});

// Per-IP limit on portal session creation. 10 per 10 min.
const portalByIp = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 m'),
  prefix: 'rl:portal:ip',
  analytics: false
});

export const limiters = {
  authStartByIp,
  authStartByEmail,
  authVerifyByIp,
  checkoutByIp,
  portalByIp
};

// Pull the caller's IP from Vercel proxy headers. Falls back to a literal so we still rate-limit
// in environments without proxy headers (rather than silently giving a free pass).
export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  return '0.0.0.0';
}

// Convenience: enforce one or more limiters in sequence. Returns null on success,
// or a {status, body} object you can return directly from the handler when limited.
//
// Fails OPEN if the rate limiter itself errors (e.g. Upstash outage). The cost of
// briefly under-limiting is much smaller than locking out every legitimate customer.
export async function enforce(limits) {
  for (const { limiter, key, message } of limits) {
    let r;
    try {
      r = await limiter.limit(key);
    } catch (err) {
      console.error('rate-limit backend error — failing open', err);
      continue;
    }
    if (!r.success) {
      const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
      return {
        status: 429,
        body: {
          error: message || 'Too many requests — slow down.',
          retryAfterSeconds: retryAfter
        }
      };
    }
  }
  return null;
}

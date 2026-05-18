import crypto from 'crypto';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function escapeQuery(s) { return String(s).replace(/'/g, "\\'"); }

async function hasActiveMembership(emailStr) {
  // Check subscription metadata directly
  const activeQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'active'`;
  let result = await stripe.subscriptions.search({ query: activeQuery, limit: 1 });
  if (result.data.length > 0) return true;
  const trialingQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'trialing'`;
  result = await stripe.subscriptions.search({ query: trialingQuery, limit: 1 });
  if (result.data.length > 0) return true;
  // Fallback: Stripe customer lookup
  const customers = await stripe.customers.list({ email: emailStr, limit: 5 });
  for (const c of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 5 });
    if (subs.data.some(s => s.status === 'active' || s.status === 'trialing')) return true;
  }
  return false;
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function emailHtml(code) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0612;font-family:Georgia,serif;color:#ede4d3;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0612;">
    <tr><td align="center" style="padding:48px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:linear-gradient(180deg,#1a0e2a 0%,#0e0818 100%);border:1px solid rgba(240,198,116,.25);border-radius:18px;">
        <tr><td style="padding:36px 36px 8px;text-align:center;">
          <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.4em;color:rgba(237,228,211,.55);">K · I · S · M · E · T</div>
        </td></tr>
        <tr><td style="padding:24px 36px 8px;text-align:center;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;color:#f0c674;">Your sign-in code</div>
        </td></tr>
        <tr><td style="padding:18px 36px 8px;text-align:center;">
          <div style="font-family:'Courier New',monospace;font-size:48px;letter-spacing:.3em;color:#ede4d3;font-weight:600;background:rgba(240,198,116,.06);border:1px solid rgba(240,198,116,.18);border-radius:14px;padding:24px 18px;display:inline-block;">${code}</div>
        </td></tr>
        <tr><td style="padding:18px 36px 36px;text-align:center;">
          <div style="font-family:Georgia,serif;font-size:14px;color:rgba(237,228,211,.65);line-height:1.6;">Valid for 10 minutes.<br/>If you didn't request this, ignore it &mdash; nothing will happen.</div>
        </td></tr>
        <tr><td style="padding:0 36px 28px;text-align:center;">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:rgba(240,198,116,.7);">kismet.cards</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'valid email required' });
    }
    const secret = process.env.SESSION_SECRET;
    if (!secret) return res.status(500).json({ error: 'server not configured' });

    res.setHeader('Cache-Control', 'no-store');

    // Check membership but DON'T leak existence to the caller — return the same response shape
    // either way (just don't actually send an email if the email isn't a member).
    const isMember = await hasActiveMembership(emailStr);

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const exp = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Token contains a HASH of the code, never the code itself.
    // Verification recomputes the same hash from the user-submitted code.
    const codeHash = crypto.createHmac('sha256', secret)
      .update(`${emailStr}|${exp}|${code}`)
      .digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const payload = { email: emailStr, exp, codeHash };
    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    const sig = sign(payloadB64, secret);
    const challengeToken = `${payloadB64}.${sig}`;

    // Only actually send the email if there's a real active subscription for this address.
    if (isMember) {
      const fromAddr = process.env.RESEND_FROM || 'Kismet <onboarding@resend.dev>';
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddr,
          reply_to: 'hello@kismet.cards',
          to: [emailStr],
          subject: `${code} is your Kismet sign-in code`,
          html: emailHtml(code),
          text: `${code} is your Kismet sign-in code.\n\nValid for 10 minutes. If you didn't request this, ignore it.\n\nkismet.cards`
        })
      });
      if (!resendResp.ok) {
        const errText = await resendResp.text();
        console.error('resend send failed', resendResp.status, errText);
        return res.status(502).json({ error: 'Could not send code — try again' });
      }
    }

    // Return the same response whether or not the email is a member.
    // Non-members will simply never receive a code; the UI shows the same step-2.
    return res.status(200).json({ challengeToken, email: emailStr });
  } catch (err) {
    console.error('auth-start error', err);
    return res.status(500).json({ error: err.message });
  }
}

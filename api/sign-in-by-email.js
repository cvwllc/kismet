import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function escapeQuery(s) { return String(s).replace(/'/g, "\\'"); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'valid email required' });
    }

    res.setHeader('Cache-Control', 'no-store');

    // First: find active or trialing subscriptions tagged with this email
    const activeQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'active'`;
    let result = await stripe.subscriptions.search({ query: activeQuery, limit: 1 });

    if (result.data.length === 0) {
      const trialingQuery = `metadata['email']:'${escapeQuery(emailStr)}' AND status:'trialing'`;
      result = await stripe.subscriptions.search({ query: trialingQuery, limit: 1 });
    }

    // Fallback: look up Stripe customers by email and check their subs
    if (result.data.length === 0) {
      const customers = await stripe.customers.list({ email: emailStr, limit: 5 });
      for (const c of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: c.id,
          status: 'all',
          limit: 5
        });
        const active = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        if (active) {
          result = { data: [active] };
          break;
        }
      }
    }

    if (result.data.length === 0) {
      return res.status(200).json({ member: false });
    }

    const sub = result.data[0];
    const m = sub.metadata || {};
    return res.status(200).json({
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
    });
  } catch (err) {
    console.error('sign-in-by-email error', err);
    return res.status(500).json({ error: err.message });
  }
}

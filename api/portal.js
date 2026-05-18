import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function escapeQuery(s) { return String(s).replace(/'/g, "\\'"); }

async function findCustomerIdByEmail(emailStr) {
  // Prefer subscription metadata (canonical for our app)
  const q = `metadata['email']:'${escapeQuery(emailStr)}'`;
  const r = await stripe.subscriptions.search({ query: q, limit: 5 });
  const active = r.data.find(s => s.status === 'active' || s.status === 'trialing');
  if (active && active.customer) return active.customer;

  // Fallback: Stripe customer list by email
  const customers = await stripe.customers.list({ email: emailStr, limit: 5 });
  if (customers.data.length > 0) return customers.data[0].id;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'valid email required' });
    }

    res.setHeader('Cache-Control', 'no-store');

    const customerId = await findCustomerIdByEmail(emailStr);
    if (!customerId) return res.status(404).json({ error: 'no customer found' });

    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: siteUrl
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('portal error', err);
    return res.status(500).json({ error: err.message });
  }
}

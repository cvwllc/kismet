import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sessionId } = req.body || {};
    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(String(sessionId))) {
      return res.status(400).json({ error: 'valid sessionId required' });
    }

    res.setHeader('Cache-Control', 'no-store');

    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['subscription', 'customer']
    });

    if (!session) return res.status(404).json({ error: 'session not found' });

    // Must be a paid (or trialing) subscription session
    const sub = session.subscription;
    const isPaid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    const subActive = sub && (sub.status === 'active' || sub.status === 'trialing');
    if (!isPaid || !subActive) {
      return res.status(402).json({ error: 'session not paid', paymentStatus: session.payment_status });
    }

    const m = (sub && sub.metadata) || session.metadata || {};
    // Canonical email = the one the customer actually completed Checkout with.
    // If they edited it at Stripe and it differs from what we stored, sync subscription metadata.
    const customer = session.customer && typeof session.customer === 'object' ? session.customer : null;
    const canonicalEmail = (
      (customer && customer.email) ||
      session.customer_details?.email ||
      session.customer_email ||
      m.email ||
      null
    );
    const canonicalLower = canonicalEmail ? String(canonicalEmail).trim().toLowerCase() : null;
    if (canonicalLower && m.email && m.email.toLowerCase() !== canonicalLower) {
      try {
        await stripe.subscriptions.update(sub.id, {
          metadata: { ...m, email: canonicalLower }
        });
        m.email = canonicalLower;
      } catch (e) {
        console.error('metadata email sync failed', e);
      }
    }

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
        email: canonicalLower || m.email || null
      }
    });
  } catch (err) {
    console.error('verify-session error', err);
    return res.status(500).json({ error: err.message });
  }
}

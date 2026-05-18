import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { seed } = req.body || {};
    if (!seed) return res.status(400).json({ error: 'seed required' });
    const seedStr = String(seed);

    res.setHeader('Cache-Control', 'no-store');

    const result = await stripe.subscriptions.search({
      query: `metadata['seed']:'${seedStr.replace(/'/g, "\\'")}' AND status:'active'`,
      limit: 1
    });

    if (result.data.length === 0) {
      const trialing = await stripe.subscriptions.search({
        query: `metadata['seed']:'${seedStr.replace(/'/g, "\\'")}' AND status:'trialing'`,
        limit: 1
      });
      if (trialing.data.length === 0) {
        return res.status(200).json({ member: false });
      }
      return res.status(200).json({
        member: true,
        status: 'trialing',
        subscriptionId: trialing.data[0].id
      });
    }

    return res.status(200).json({
      member: true,
      status: 'active',
      subscriptionId: result.data[0].id
    });
  } catch (err) {
    console.error('check-membership error', err);
    return res.status(500).json({ error: err.message });
  }
}

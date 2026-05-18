import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { signatureSeed, name } = req.body || {};
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${siteUrl}/?paid=1&seed=${encodeURIComponent(signatureSeed || '')}`,
      cancel_url: `${siteUrl}/?canceled=1`,
      client_reference_id: signatureSeed ? String(signatureSeed) : undefined,
      metadata: {
        signatureSeed: String(signatureSeed || ''),
        name: String(name || '')
      },
      allow_promotion_codes: true
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe error', err);
    res.status(500).json({ error: err.message });
  }
}

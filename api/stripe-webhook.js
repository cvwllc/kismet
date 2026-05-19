// Stripe webhook handler.
//
// Listens for `charge.refunded` events. When a charge is FULLY refunded and
// it was paying a subscription invoice, the subscription is canceled immediately.
//
// This closes the operator footgun: refunding a customer's charge from the Stripe
// dashboard without also canceling their subscription, which would let the next
// renewal silently re-bill (or — in the worst case — give the customer a free month
// of service after a refund).
//
// Vercel's default JSON body parser must be disabled here because Stripe signature
// verification requires the EXACT raw bytes of the request body.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function handleChargeRefunded(charge) {
  // Only act on FULL refunds. Partial refunds don't kill the subscription.
  if (charge.refunded !== true) return { action: 'skipped', reason: 'partial refund' };
  // Charges not tied to an invoice (= one-off charges) have nothing to cancel.
  if (!charge.invoice) return { action: 'skipped', reason: 'no invoice on charge' };

  const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice.id;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (!invoice.subscription) return { action: 'skipped', reason: 'invoice not for subscription' };

  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;

  // Cancel immediately. cancel_at_period_end=false is the default.
  try {
    const canceled = await stripe.subscriptions.cancel(subId);
    return {
      action: 'canceled',
      subscriptionId: subId,
      previousStatus: canceled.status === 'canceled' ? 'unknown→canceled' : canceled.status
    };
  } catch (err) {
    // Already canceled → idempotent no-op.
    const msg = (err && err.raw && err.raw.message) || (err && err.message) || '';
    if (
      err.code === 'resource_missing' ||
      /already canceled/i.test(msg) ||
      /No such subscription/i.test(msg)
    ) {
      return { action: 'skipped', reason: 'already canceled', subscriptionId: subId };
    }
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    // Return 500 — Stripe will retry; once secret is configured, retries succeed.
    return res.status(500).json({ error: 'webhook not configured' });
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('webhook signature verification failed', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    if (event.type === 'charge.refunded') {
      const result = await handleChargeRefunded(event.data.object);
      console.log('charge.refunded handled', JSON.stringify(result));
    }
    // Future event handlers can go here.
  } catch (err) {
    console.error('webhook handler error', err);
    // Return 200 anyway: we don't want Stripe to retry indefinitely on logic errors.
    // Real failures (e.g. signature) already returned 4xx above.
  }

  return res.status(200).json({ received: true });
}

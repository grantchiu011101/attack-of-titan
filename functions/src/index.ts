import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

initializeApp();

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpsError('failed-precondition', 'STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export const createCheckoutSession = onCall(async (request) => {
  const uid = request.auth?.uid || String(request.data?.uid || '');
  const product = String(request.data?.product || '');
  const priceId = String(request.data?.priceId || '');
  if (!priceId) throw new HttpsError('invalid-argument', 'Missing Stripe price id');

  const origin = request.rawRequest?.headers.origin || 'http://localhost:5173';
  const session = await stripeClient().checkout.sessions.create({
    mode: product === 'scout_pass' ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
    client_reference_id: uid || undefined,
    metadata: { uid, product },
  });
  return { id: session.id, url: session.url };
});

export const stripeWebhook = onRequest(async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).send('webhook secret missing');
    return;
  }
  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    res.status(400).send('no signature');
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(req.rawBody, sig, secret);
  } catch {
    res.status(400).send('invalid signature');
    return;
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid || session.client_reference_id;
    if (uid && session.metadata?.product === 'scout_pass') {
      await getFirestore().doc(`scouts/${uid}`).set({ scoutPass: true }, { merge: true });
    }
  }
  res.json({ received: true });
});

import { getFunctions, httpsCallable } from 'firebase/functions';
import { stripePublishableKey } from '../config';
import { getFirebaseApp } from './firebase';
import { getProfile, setScoutPassLocal } from './auth';
import { getFlags } from './remoteConfig';

export type ProductId = 'scout_pass' | 'gas_pack';

export async function checkout(product: ProductId): Promise<void> {
  const app = getFirebaseApp();
  const profile = getProfile();
  const flags = getFlags();
  const priceId = product === 'scout_pass' ? flags.scoutPassPriceId : flags.gasPackPriceId;

  if (app && stripePublishableKey && priceId) {
    const callable = httpsCallable<{ product: ProductId; priceId: string; uid?: string }, { id: string; url: string }>(
      getFunctions(app),
      'createCheckoutSession',
    );
    const { data } = await callable({ product, priceId, uid: profile?.uid });
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    throw new Error('Checkout session did not return a URL');
  }

  // Demo / local fallback so the shop is testable without keys.
  if (product === 'scout_pass') {
    setScoutPassLocal(true);
    alert('Demo mode: Scout Pass unlocked on this device. Connect Stripe + Firebase to take real payments.');
    return;
  }
  alert('Demo mode: gas pack granted. Connect Stripe + Firebase Functions for live checkout.');
}

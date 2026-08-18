import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { firebaseConfig, isFirebaseConfigured } from '../config';

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export async function initAnalytics(): Promise<Analytics | null> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp || analytics) return analytics;
  if (await isSupported()) {
    analytics = getAnalytics(firebaseApp);
  }
  return analytics;
}

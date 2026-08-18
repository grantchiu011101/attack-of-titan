export const GAME_NAME = 'Attack of Titan';
export const GAME_TAGLINE = 'Beyond the Walls';

export type HudVariant = 'classic' | 'compact';
export type Difficulty = 'easy' | 'normal' | 'realism';

export interface RemoteFlags {
  hudVariant: HudVariant;
  tutorialEnabled: boolean;
  napeGlowAlways: boolean;
  gasRegenPerSec: number;
  titanBaseCount: number;
  shadowQuality: 'off' | 'low' | 'high';
  scoutPassPriceId: string;
  gasPackPriceId: string;
  abBucket: 'A' | 'B';
}

export const DEFAULT_FLAGS: RemoteFlags = {
  hudVariant: 'classic',
  tutorialEnabled: true,
  napeGlowAlways: true,
  gasRegenPerSec: 4.5,
  titanBaseCount: 3,
  shadowQuality: 'high',
  scoutPassPriceId: '',
  gasPackPriceId: '',
  abBucket: 'A',
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

export const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const demoMode =
  import.meta.env.VITE_DEMO_MODE === 'true' || !firebaseConfig.apiKey || !firebaseConfig.projectId;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type Auth,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import type { ScoutProfile } from '../types';

let recaptcha: RecaptchaVerifier | null = null;
let phoneConfirmation: ConfirmationResult | null = null;
const listeners = new Set<(profile: ScoutProfile | null) => void>();
let currentProfile: ScoutProfile | null = null;

function authOrNull(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

function guestProfile(): ScoutProfile {
  const stored = localStorage.getItem('aot-guest-name') || 'Guest Scout';
  return {
    uid: 'guest-local',
    displayName: stored,
    photoURL: null,
    provider: 'guest',
    scoutPass: localStorage.getItem('aot-scout-pass') === '1',
    bestScore: Number(localStorage.getItem('aot-best-score') || 0),
    titanKills: Number(localStorage.getItem('aot-kills') || 0),
  };
}

async function profileFromUser(user: User): Promise<ScoutProfile> {
  const app = getFirebaseApp();
  const base: ScoutProfile = {
    uid: user.uid,
    displayName: user.displayName || (user.phoneNumber ? `Scout ${user.phoneNumber.slice(-4)}` : 'Scout'),
    photoURL: user.photoURL,
    provider: user.phoneNumber ? 'phone' : user.isAnonymous ? 'guest' : 'google',
    scoutPass: false,
    bestScore: 0,
    titanKills: 0,
  };
  if (!app) return base;
  const db = getFirestore(app);
  const ref = doc(db, 'scouts', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      ...base,
      displayName: (data.displayName as string) || base.displayName,
      scoutPass: Boolean(data.scoutPass),
      bestScore: Number(data.bestScore || 0),
      titanKills: Number(data.titanKills || 0),
    };
  }
  await setDoc(ref, {
    displayName: base.displayName,
    photoURL: base.photoURL,
    provider: base.provider,
    scoutPass: false,
    bestScore: 0,
    titanKills: 0,
    createdAt: serverTimestamp(),
  });
  return base;
}

function emit(profile: ScoutProfile | null): void {
  currentProfile = profile;
  listeners.forEach((fn) => fn(profile));
}

export function getProfile(): ScoutProfile | null {
  return currentProfile;
}

export function onProfile(fn: (profile: ScoutProfile | null) => void): () => void {
  listeners.add(fn);
  fn(currentProfile);
  return () => listeners.delete(fn);
}

export async function initAuth(): Promise<ScoutProfile> {
  const auth = authOrNull();
  if (!auth) {
    const guest = guestProfile();
    emit(guest);
    return guest;
  }

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        const profile = await profileFromUser(user);
        emit(profile);
        resolve(profile);
      } else {
        const guest = guestProfile();
        emit(guest);
        resolve(guest);
      }
    });
  });
}

export async function loginGoogle(): Promise<ScoutProfile> {
  const auth = authOrNull();
  if (!auth) throw new Error('Firebase Auth is not configured');
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  const profile = await profileFromUser(cred.user);
  emit(profile);
  return profile;
}

export async function loginAnonymous(): Promise<ScoutProfile> {
  const auth = authOrNull();
  if (!auth) {
    const guest = guestProfile();
    emit(guest);
    return guest;
  }
  const cred = await signInAnonymously(auth);
  const profile = await profileFromUser(cred.user);
  emit(profile);
  return profile;
}

export async function sendPhoneCode(phoneE164: string, recaptchaElId: string): Promise<void> {
  const auth = authOrNull();
  if (!auth) throw new Error('Firebase Auth is not configured');
  recaptcha?.clear();
  recaptcha = new RecaptchaVerifier(auth, recaptchaElId, { size: 'invisible' });
  phoneConfirmation = await signInWithPhoneNumber(auth, phoneE164, recaptcha);
}

export async function confirmPhoneCode(code: string): Promise<ScoutProfile> {
  if (!phoneConfirmation) throw new Error('Send a verification code first');
  const cred = await phoneConfirmation.confirm(code);
  const profile = await profileFromUser(cred.user);
  emit(profile);
  return profile;
}

export async function logout(): Promise<void> {
  const auth = authOrNull();
  if (auth) await signOut(auth);
  emit(guestProfile());
}

export async function saveMatchStats(kills: number, score: number): Promise<void> {
  const profile = currentProfile;
  if (!profile) return;
  profile.titanKills += kills;
  profile.bestScore = Math.max(profile.bestScore, score);
  if (profile.uid === 'guest-local') {
    localStorage.setItem('aot-kills', String(profile.titanKills));
    localStorage.setItem('aot-best-score', String(profile.bestScore));
    emit({ ...profile });
    return;
  }
  const app = getFirebaseApp();
  if (!app) return;
  const db = getFirestore(app);
  await setDoc(
    doc(db, 'scouts', profile.uid),
    {
      titanKills: profile.titanKills,
      bestScore: profile.bestScore,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  emit({ ...profile });
}

export function setScoutPassLocal(active: boolean): void {
  localStorage.setItem('aot-scout-pass', active ? '1' : '0');
  if (currentProfile) {
    currentProfile.scoutPass = active;
    emit({ ...currentProfile });
  }
}

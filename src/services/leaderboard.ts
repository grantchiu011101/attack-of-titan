import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import { getProfile } from './auth';
import type { MatchResult } from '../types';

export interface LeaderboardRow {
  name: string;
  score: number;
  kills: number;
  wave: number;
}

export async function submitRun(result: MatchResult): Promise<void> {
  const app = getFirebaseApp();
  const profile = getProfile();
  if (!app || !profile || profile.uid === 'guest-local') return;
  const db = getFirestore(app);
  await addDoc(collection(db, 'runs'), {
    uid: profile.uid,
    name: profile.displayName,
    score: result.score,
    kills: result.kills,
    wave: result.wave,
    durationSec: result.durationSec,
    difficulty: result.difficulty,
    createdAt: serverTimestamp(),
  });
}

export async function topRuns(): Promise<LeaderboardRow[]> {
  const app = getFirebaseApp();
  if (!app) return [];
  const db = getFirestore(app);
  const q = query(collection(db, 'runs'), orderBy('score', 'desc'), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      name: String(data.name || 'Scout'),
      score: Number(data.score || 0),
      kills: Number(data.kills || 0),
      wave: Number(data.wave || 0),
    };
  });
}

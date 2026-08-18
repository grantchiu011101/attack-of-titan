import type { RemoteFlags } from '../config';

const KEY = 'aot-ab-bucket';

/** Sticky A/B assignment so HUD and tutorial variants stay consistent per device. */
export function assignBucket(): 'A' | 'B' {
  const existing = localStorage.getItem(KEY);
  if (existing === 'A' || existing === 'B') return existing;
  const bucket: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
  localStorage.setItem(KEY, bucket);
  return bucket;
}

/**
 * Bucket A: classic HUD, tutorial on, nape always glows (easier onboarding).
 * Bucket B: compact HUD, skip tutorial, nape glow only in slash range (higher skill).
 */
export function applyBucket(flags: RemoteFlags, bucket: 'A' | 'B'): RemoteFlags {
  if (flags.hudVariant !== 'classic' && flags.hudVariant !== 'compact') {
    flags.hudVariant = bucket === 'A' ? 'classic' : 'compact';
  } else if (!flags.scoutPassPriceId) {
    flags.hudVariant = bucket === 'A' ? 'classic' : 'compact';
    flags.tutorialEnabled = bucket === 'A';
    flags.napeGlowAlways = bucket === 'A';
  }
  flags.abBucket = bucket;
  return flags;
}

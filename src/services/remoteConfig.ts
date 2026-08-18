import { fetchAndActivate, getRemoteConfig, getValue, type RemoteConfig } from 'firebase/remote-config';
import { DEFAULT_FLAGS, type RemoteFlags } from '../config';
import { getFirebaseApp } from './firebase';
import { assignBucket, applyBucket } from './abtest';

let cached: RemoteFlags = { ...DEFAULT_FLAGS };

export function getFlags(): RemoteFlags {
  return cached;
}

function readString(rc: RemoteConfig, key: string, fallback: string): string {
  const v = getValue(rc, key).asString();
  return v || fallback;
}

function readNumber(rc: RemoteConfig, key: string, fallback: number): number {
  const v = getValue(rc, key).asNumber();
  return Number.isFinite(v) && v !== 0 ? v : fallback;
}

function readBool(rc: RemoteConfig, key: string, fallback: boolean): boolean {
  const raw = getValue(rc, key);
  const s = raw.asString();
  if (!s) return fallback;
  return raw.asBoolean();
}

export async function initRemoteConfig(): Promise<RemoteFlags> {
  const bucket = assignBucket();
  const app = getFirebaseApp();
  if (!app) {
    cached = applyBucket({ ...DEFAULT_FLAGS }, bucket);
    return cached;
  }

  const rc = getRemoteConfig(app);
  rc.settings.minimumFetchIntervalMillis = 60_000;
  rc.defaultConfig = {
    hud_variant: DEFAULT_FLAGS.hudVariant,
    tutorial_enabled: String(DEFAULT_FLAGS.tutorialEnabled),
    nape_glow_always: String(DEFAULT_FLAGS.napeGlowAlways),
    gas_regen_per_sec: String(DEFAULT_FLAGS.gasRegenPerSec),
    titan_base_count: String(DEFAULT_FLAGS.titanBaseCount),
    shadow_quality: DEFAULT_FLAGS.shadowQuality,
    scout_pass_price_id: '',
    gas_pack_price_id: '',
  };

  try {
    await fetchAndActivate(rc);
    const fetched: RemoteFlags = {
      hudVariant: readString(rc, 'hud_variant', DEFAULT_FLAGS.hudVariant) as RemoteFlags['hudVariant'],
      tutorialEnabled: readBool(rc, 'tutorial_enabled', DEFAULT_FLAGS.tutorialEnabled),
      napeGlowAlways: readBool(rc, 'nape_glow_always', DEFAULT_FLAGS.napeGlowAlways),
      gasRegenPerSec: readNumber(rc, 'gas_regen_per_sec', DEFAULT_FLAGS.gasRegenPerSec),
      titanBaseCount: readNumber(rc, 'titan_base_count', DEFAULT_FLAGS.titanBaseCount),
      shadowQuality: readString(rc, 'shadow_quality', DEFAULT_FLAGS.shadowQuality) as RemoteFlags['shadowQuality'],
      scoutPassPriceId: readString(rc, 'scout_pass_price_id', ''),
      gasPackPriceId: readString(rc, 'gas_pack_price_id', ''),
      abBucket: bucket,
    };
    cached = applyBucket(fetched, bucket);
  } catch {
    cached = applyBucket({ ...DEFAULT_FLAGS }, bucket);
  }
  return cached;
}

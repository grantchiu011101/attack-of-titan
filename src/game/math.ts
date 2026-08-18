import * as pc from 'playcanvas';
import type { Hookable } from '../types';

const tmp = new pc.Vec3();

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const MIN_HOOK = 4;

function originInside(
  origin: pc.Vec3,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  pad = 0.6,
): boolean {
  return (
    origin.x >= min.x - pad &&
    origin.x <= max.x + pad &&
    origin.y >= min.y - pad &&
    origin.y <= max.y + pad &&
    origin.z >= min.z - pad &&
    origin.z <= max.z + pad
  );
}

/** Slab-method ray vs AABB. Returns distance or null. Ignores hits closer than minDist. */
export function rayAabb(
  origin: pc.Vec3,
  dir: pc.Vec3,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  maxDist: number,
  minDist = MIN_HOOK,
): number | null {
  if (originInside(origin, min, max)) return null;
  let tmin = minDist;
  let tmax = maxDist;
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (const axis of axes) {
    const d = dir[axis];
    const o = origin[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    const inv = 1 / d;
    let t0 = (min[axis] - o) * inv;
    let t1 = (max[axis] - o) * inv;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
    }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) return null;
  }
  return tmin;
}

function clampToAabb(
  x: number,
  y: number,
  z: number,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  out: pc.Vec3,
): pc.Vec3 {
  out.set(clamp(x, min.x, max.x), clamp(y, min.y, max.y), clamp(z, min.z, max.z));
  return out;
}

export function findHookTarget(
  origin: pc.Vec3,
  dir: pc.Vec3,
  hookables: Hookable[],
  maxDist: number,
): { point: pc.Vec3; hookable: Hookable; dist: number } | null {
  tmp.copy(dir);
  if (tmp.lengthSq() < 1e-8) return null;
  tmp.normalize();

  let best: { point: pc.Vec3; hookable: Hookable; dist: number } | null = null;
  let bestScore = -1e9;
  const point = new pc.Vec3();

  for (const h of hookables) {
    if (originInside(origin, h.min, h.max, 1.5)) continue;
    const cx = (h.min.x + h.max.x) * 0.5;
    const cy = Math.min(h.max.y - 0.4, Math.max(h.min.y + 1, origin.y));
    const cz = (h.min.z + h.max.z) * 0.5;
    const dx = cx - origin.x;
    const dy = cy - origin.y;
    const dz = cz - origin.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 2 || dist > maxDist) continue;
    const aligned = (tmp.x * dx + tmp.y * dy + tmp.z * dz) / dist;
    // Anything in the forward hemisphere is eligible; prefer what's near the look ray.
    if (aligned < 0.05) continue;
    const t = clamp(dx * tmp.x + dy * tmp.y + dz * tmp.z, 2, maxDist);
    clampToAabb(origin.x + tmp.x * t, origin.y + tmp.y * t, origin.z + tmp.z * t, h.min, h.max, point);
    const pd = point.distance(origin);
    if (pd < 2 || pd > maxDist) continue;
    const score = aligned * 220 - pd * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = { point: point.clone(), hookable: h, dist: pd };
    }
  }
  return best;
}

/** @deprecated use findHookTarget */
export function raycastHookables(
  origin: pc.Vec3,
  dir: pc.Vec3,
  hookables: Hookable[],
  maxDist: number,
): { point: pc.Vec3; hookable: Hookable; dist: number } | null {
  return findHookTarget(origin, dir, hookables, maxDist);
}

export function aabbContains(h: Hookable, x: number, y: number, z: number, pad = 0): boolean {
  return (
    x >= h.min.x - pad &&
    x <= h.max.x + pad &&
    y >= h.min.y - pad &&
    y <= h.max.y + pad &&
    z >= h.min.z - pad &&
    z <= h.max.z + pad
  );
}

export function lookYawPitch(yaw: number, pitch: number, out: pc.Vec3): pc.Vec3 {
  const cp = Math.cos(pitch);
  out.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
  return out;
}

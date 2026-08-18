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

/** Slab-method ray vs AABB. Returns distance or null. */
export function rayAabb(
  origin: pc.Vec3,
  dir: pc.Vec3,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  maxDist: number,
): number | null {
  let tmin = 0;
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

export function raycastHookables(
  origin: pc.Vec3,
  dir: pc.Vec3,
  hookables: Hookable[],
  maxDist: number,
): { point: pc.Vec3; hookable: Hookable; dist: number } | null {
  tmp.copy(dir).normalize();
  let best: { point: pc.Vec3; hookable: Hookable; dist: number } | null = null;
  for (const h of hookables) {
    const dist = rayAabb(origin, tmp, h.min, h.max, maxDist);
    if (dist === null) continue;
    if (!best || dist < best.dist) {
      const point = new pc.Vec3(origin.x + tmp.x * dist, origin.y + tmp.y * dist, origin.z + tmp.z * dist);
      best = { point, hookable: h, dist };
    }
  }
  return best;
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

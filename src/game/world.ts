import * as pc from 'playcanvas';
import type { Hookable } from '../types';
import { mats, primitive } from './materials';
import { aabbContains, mulberry32 } from './math';

export const WORLD_RADIUS = 190;
export const WALL_HEIGHT = 24;
export const SPAWN = { x: 0, y: WALL_HEIGHT + 1.75, z: -WORLD_RADIUS };

export interface SupplyCrate {
  x: number;
  y: number;
  z: number;
  r: number;
  entity: pc.Entity;
}

export class World {
  hookables: Hookable[] = [];
  buildings: Hookable[] = [];
  supplies: SupplyCrate[] = [];
  private dynamic: Hookable[] = [];
  private nextId = 1;

  constructor(private app: pc.Application) {}

  build(): void {
    this.ground();
    this.outerWall();
    this.district();
    this.forest();
    this.poles();
    this.supply();
  }

  heightAt(x: number, z: number): number {
    let h = 0;
    for (const b of this.hookables) {
      if (b.kind === 'tree' || b.kind === 'pole') continue;
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) {
        h = Math.max(h, b.max.y);
      }
    }
    return h;
  }

  allHookables(): Hookable[] {
    return this.dynamic.length ? this.hookables.concat(this.dynamic) : this.hookables;
  }

  setDynamicHookables(list: Hookable[]): void {
    this.dynamic = list;
  }

  blockedAt(x: number, y: number, z: number, radius: number): boolean {
    for (const b of this.buildings) {
      if (aabbContains(b, x, y, z, radius) && y < b.max.y - 0.4) return true;
    }
    return false;
  }

  private addHook(kind: Hookable['kind'], min: Hookable['min'], max: Hookable['max']): Hookable {
    const h: Hookable = { id: this.nextId++, kind, min, max };
    this.hookables.push(h);
    if (kind === 'building') this.buildings.push(h);
    return h;
  }

  private ground(): void {
    const g = primitive(this.app, 'box', mats.grass(), { name: 'ground', castShadows: false });
    g.setLocalScale(WORLD_RADIUS * 2.4, 0.5, WORLD_RADIUS * 2.4);
    g.setPosition(0, -0.25, 0);

    this.lights();
  }

  private lights(): void {
    const scene = this.app.scene;
    scene.ambientLight = new pc.Color(0.16, 0.18, 0.22);
    scene.fog.type = pc.FOG_LINEAR;
    scene.fog.start = 90;
    scene.fog.end = 280;
    scene.fog.color = new pc.Color(0.55, 0.62, 0.7);
    scene.lighting.shadowsEnabled = true;
    scene.lighting.shadowAtlasResolution = 2048;

    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.91, 0.74),
      intensity: 1.85,
      castShadows: true,
      shadowIntensity: 0.9,
      shadowDistance: 320,
      shadowResolution: 2048,
      shadowType: pc.SHADOW_PCF3_32F,
      numCascades: 4,
      cascadeBlend: 0.2,
      shadowBias: 0.08,
      normalOffsetBias: 0.12,
      shadowUpdateMode: pc.SHADOWUPDATE_REALTIME,
    });
    sun.setEulerAngles(52, -38, 0);
    this.app.root.addChild(sun);

    const fill = new pc.Entity('sky-fill');
    fill.addComponent('light', {
      type: 'directional',
      color: new pc.Color(0.42, 0.55, 0.72),
      intensity: 0.28,
      castShadows: false,
    });
    fill.setEulerAngles(-25, 150, 0);
    this.app.root.addChild(fill);

    const rim = new pc.Entity('rim');
    rim.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.78, 0.52),
      intensity: 0.22,
      castShadows: false,
    });
    rim.setEulerAngles(15, 200, 0);
    this.app.root.addChild(rim);

    const lamps: Array<[number, number, number]> = [
      [0, 6, 8],
      [-30, 5, -12],
      [36, 5, 22],
      [0, 8, -118],
      [-12, 10, -165],
      [12, 10, -165],
      [2, 14, 6],
    ];
    for (const [x, y, z] of lamps) {
      this.lantern(x, y, z);
    }
  }

  private lantern(x: number, y: number, z: number): void {
    const bulb = primitive(this.app, 'sphere', mats.supply(), { name: 'lantern', castShadows: false });
    bulb.setLocalScale(0.35, 0.35, 0.35);
    bulb.setPosition(x, y, z);

    const light = new pc.Entity('lamp');
    light.addComponent('light', {
      type: 'omni',
      color: new pc.Color(1, 0.7, 0.32),
      intensity: 2.6,
      range: 26,
      falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
      castShadows: false,
    });
    light.setPosition(x, y, z);
    this.app.root.addChild(light);
  }

  private outerWall(): void {
    const t = 8;
    const r = WORLD_RADIUS;
    const h = WALL_HEIGHT;
    const segs: Array<[number, number, number, number]> = [
      [0, -r, r * 2 + t, t],
      [0, r, r * 2 + t, t],
      [-r, 0, t, r * 2],
      [r, 0, t, r * 2],
    ];
    for (const [x, z, w, d] of segs) {
      const wall = primitive(this.app, 'box', mats.wall(), { name: 'wall' });
      wall.setLocalScale(w, h, d);
      wall.setPosition(x, h / 2, z);
      this.addHook(
        'wall',
        { x: x - w / 2, y: 0, z: z - d / 2 },
        { x: x + w / 2, y: h, z: z + d / 2 },
      );
      const cap = primitive(this.app, 'box', mats.stone(), { name: 'battlement' });
      cap.setLocalScale(w + 1.2, 1.6, d + 1.2);
      cap.setPosition(x, h + 0.6, z);
    }

    const gate = primitive(this.app, 'box', mats.wood(), { name: 'gate' });
    gate.setLocalScale(18, 16, 3);
    gate.setPosition(0, 8, -r + 2);
  }

  private district(): void {
    const rng = mulberry32(20260818);
    const plots = [
      [-40, -20], [-18, -28], [8, -24], [32, -18],
      [-48, 8], [-22, 14], [6, 10], [30, 18], [52, 6],
      [-36, 38], [-8, 42], [20, 36], [44, 40],
      [-14, -8], [16, -6], [-54, -36], [58, -32],
    ];
    for (const [px, pz] of plots) {
      const w = 8 + rng() * 10;
      const d = 8 + rng() * 10;
      const h = 8 + rng() * 14;
      this.building(px + (rng() - 0.5) * 4, pz + (rng() - 0.5) * 4, w, d, h, rng);
    }

    const plaza = primitive(this.app, 'cylinder', mats.stone(), { name: 'plaza', castShadows: false });
    plaza.setLocalScale(16, 0.15, 16);
    plaza.setPosition(0, 0.08, 4);

    const tower = primitive(this.app, 'cylinder', mats.stone(), { name: 'spire' });
    tower.setLocalScale(4.5, 22, 4.5);
    tower.setPosition(2, 11, 6);
    const spire = primitive(this.app, 'cone', mats.roof(), { name: 'spire-roof' });
    spire.setLocalScale(6, 8, 6);
    spire.setPosition(2, 26, 6);
    this.addHook('building', { x: -1, y: 0, z: 3 }, { x: 5, y: 26, z: 9 });
  }

  private building(x: number, z: number, w: number, d: number, h: number, rng: () => number): void {
    const body = primitive(this.app, 'box', mats.stone(), { name: 'house' });
    body.setLocalScale(w, h, d);
    body.setPosition(x, h / 2, z);
    const roof = primitive(this.app, 'box', mats.roof(), { name: 'roof' });
    roof.setLocalScale(w + 1.2, 1.4, d + 1.2);
    roof.setPosition(x, h + 0.5, z);
    const peak = primitive(this.app, 'box', mats.roof(), { name: 'peak' });
    peak.setLocalScale(w * 0.35, 2.2, d + 0.4);
    peak.setPosition(x, h + 2, z);

    const winMat = mats.window();
    for (let i = 0; i < 2; i++) {
      const wy = 2.5 + i * Math.min(4, h / 3);
      const win = primitive(this.app, 'box', winMat, { name: 'window', castShadows: false });
      win.setLocalScale(1.2, 1.6, 0.15);
      win.setPosition(x, wy, z + d / 2 + 0.05);
    }

    this.addHook(
      'building',
      { x: x - w / 2, y: 0, z: z - d / 2 },
      { x: x + w / 2, y: h + 1.4, z: z + d / 2 },
    );

    if (rng() > 0.55) {
      const chimney = primitive(this.app, 'box', mats.wood(), { name: 'chimney' });
      chimney.setLocalScale(1.1, 3.2, 1.1);
      chimney.setPosition(x + w * 0.3, h + 2.4, z - d * 0.2);
    }
  }

  private forest(): void {
    const rng = mulberry32(77);
    for (let i = 0; i < 70; i++) {
      const ang = rng() * Math.PI * 1.2 + 0.4;
      const rad = 55 + rng() * 110;
      const x = Math.cos(ang) * rad + (rng() - 0.5) * 20;
      const z = Math.sin(ang) * rad + 40 + (rng() - 0.5) * 30;
      if (Math.hypot(x, z) > WORLD_RADIUS - 18) continue;
      this.tree(x, z, 0.7 + rng() * 0.8, 9 + rng() * 10);
    }
    for (let i = 0; i < 18; i++) {
      const x = -80 + (i % 6) * 12 + (rng() - 0.5) * 6;
      const z = -70 + Math.floor(i / 6) * 14;
      this.tree(x, z, 0.9, 12);
    }
    for (let i = 0; i < 10; i++) {
      this.tree(-55 + i * 12, -155, 0.85, 13);
      this.tree(-50 + i * 11, -125, 0.95, 14);
      this.tree(-40 + i * 10, -95, 0.8, 12);
    }
  }

  private tree(x: number, z: number, girth: number, height: number): void {
    const trunk = primitive(this.app, 'cylinder', mats.bark(), { name: 'trunk' });
    trunk.setLocalScale(girth, height, girth);
    trunk.setPosition(x, height / 2, z);
    const foliage = primitive(this.app, 'sphere', mats.foliage(), { name: 'leaves' });
    const fr = 3.2 + girth * 2;
    foliage.setLocalScale(fr, fr * 1.1, fr);
    foliage.setPosition(x, height + fr * 0.35, z);
    const foliage2 = primitive(this.app, 'sphere', mats.foliage(), { name: 'leaves2' });
    foliage2.setLocalScale(fr * 0.7, fr * 0.7, fr * 0.7);
    foliage2.setPosition(x + girth, height + fr * 0.1, z - girth);
    this.addHook(
      'tree',
      { x: x - fr, y: 0, z: z - fr },
      { x: x + fr, y: height + fr, z: z + fr },
    );
  }

  private poles(): void {
    const spots = [
      [-20, -50], [20, -50], [-60, 20], [60, 24], [0, 70], [-70, -10], [70, -8],
      [-12, -165], [12, -165], [-28, -140], [28, -140], [0, -118],
    ];
    for (const [x, z] of spots) {
      const p = primitive(this.app, 'cylinder', mats.wood(), { name: 'pole' });
      p.setLocalScale(0.45, 14, 0.45);
      p.setPosition(x, 7, z);
      this.addHook('pole', { x: x - 0.8, y: 0, z: z - 0.8 }, { x: x + 0.8, y: 14, z: z + 0.8 });
    }
  }

  private supply(): void {
    const spots = [
      [0, 1, 8],
      [-30, 1, -12],
      [36, 1, 22],
    ];
    for (const [x, y, z] of spots) {
      const e = primitive(this.app, 'box', mats.supply(), { name: 'supply' });
      e.setLocalScale(1.6, 1.4, 1.6);
      e.setPosition(x, y, z);
      this.supplies.push({ x, y, z, r: 2.4, entity: e });
    }
  }
}

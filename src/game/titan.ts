import * as pc from 'playcanvas';
import { audio } from './audio';
import { mats, primitive } from './materials';
import { clamp } from './math';
import type { Player } from './player';
import { WORLD_RADIUS, type World } from './world';

export type TitanKind = 'normal' | 'aberrant';

export class Titan {
  entity: pc.Entity;
  nape: pc.Entity;
  kind: TitanKind;
  hp = 1;
  alive = true;
  height: number;
  yaw = 0;
  private speed: number;
  private state: 'wander' | 'chase' | 'attack' | 'dead' = 'wander';
  private attackT = 0;
  private wanderT = 0;
  private wanderYaw = 0;
  private deadT = 0;
  private napeWorld = new pc.Vec3();
  private tmp = new pc.Vec3();

  constructor(
    private app: pc.Application,
    x: number,
    z: number,
    kind: TitanKind,
  ) {
    this.kind = kind;
    this.height = kind === 'aberrant' ? 16 + Math.random() * 4 : 11 + Math.random() * 5;
    this.speed = kind === 'aberrant' ? 7.2 : 4.4;
    this.entity = this.build(x, z);
    this.nape = this.entity.findByName('nape') as pc.Entity;
    this.wanderYaw = Math.random() * Math.PI * 2;
  }

  napePosition(): pc.Vec3 {
    return this.nape.getWorldTransform().getTranslation(this.napeWorld);
  }

  update(dt: number, player: Player, world: World): void {
    if (!this.alive) {
      this.deadT += dt;
      const s = Math.max(0.02, 1 - this.deadT * 1.4);
      this.entity.setLocalScale(s, s * (1 - this.deadT * 0.4), s);
      if (this.deadT > 1.15) this.entity.enabled = false;
      return;
    }

    const pos = this.entity.getPosition();
    const p = player.position;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const detect = this.kind === 'aberrant' ? 70 : 48;

    if (dist < 5.5 && p.y < pos.y + this.height * 0.55) {
      this.state = 'attack';
    } else if (dist < detect && player.stats.alive) {
      this.state = 'chase';
    } else {
      this.state = 'wander';
    }

    if (this.state === 'chase') {
      this.yaw = Math.atan2(dx, dz);
      this.walk(dt, pos, world, this.speed);
      this.facePlayer(p, pos);
    } else if (this.state === 'wander') {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 3;
        this.wanderYaw += (Math.random() - 0.5) * 1.6;
      }
      this.yaw = this.wanderYaw;
      this.walk(dt, pos, world, this.speed * 0.45);
    } else if (this.state === 'attack') {
      this.attackT += dt;
      this.facePlayer(p, pos);
      if (this.attackT > 0.55) {
        this.attackT = 0;
        if (dist < 6.5 && p.y < pos.y + this.height * 0.7 && player.stats.alive) {
          player.takeDamage(this.kind === 'aberrant' ? 38 : 28);
        }
      }
      this.entity.setLocalEulerAngles(8, this.yaw * pc.math.RAD_TO_DEG, 0);
      return;
    }

    this.entity.setPosition(pos);
    this.entity.setEulerAngles(0, this.yaw * pc.math.RAD_TO_DEG, 0);
  }

  kill(score: number): number {
    if (!this.alive) return 0;
    this.alive = false;
    this.hp = 0;
    this.state = 'dead';
    audio.kill();
    this.nape.enabled = false;
    return score;
  }

  setNapeVisible(on: boolean): void {
    if (!this.alive) return;
    this.nape.enabled = on;
  }

  hookAabb() {
    const p = this.entity.getPosition();
    const w = 2.4;
    return {
      id: 0,
      kind: 'titan' as const,
      min: { x: p.x - w, y: p.y, z: p.z - w },
      max: { x: p.x + w, y: p.y + this.height, z: p.z + w },
    };
  }

  private walk(dt: number, pos: pc.Vec3, world: World, speed: number): void {
    const nx = pos.x + Math.sin(this.yaw) * speed * dt;
    const nz = pos.z + Math.cos(this.yaw) * speed * dt;
    if (Math.hypot(nx, nz) < WORLD_RADIUS - 14 && !world.blockedAt(nx, 2, nz, 1.2)) {
      pos.x = nx;
      pos.z = nz;
    } else {
      this.wanderYaw += 1.2;
      this.yaw += 1.2;
    }
    pos.y = world.heightAt(pos.x, pos.z);
  }

  private facePlayer(p: pc.Vec3, pos: pc.Vec3): void {
    this.yaw = Math.atan2(p.x - pos.x, p.z - pos.z);
  }

  private build(x: number, z: number): pc.Entity {
    const root = new pc.Entity(`titan-${this.kind}`);
    this.app.root.addChild(root);
    const skin = this.kind === 'aberrant' ? mats.titanAberrant() : mats.titan();
    const s = this.height / 12;

    const pelvis = primitive(this.app, 'box', skin, { name: 'pelvis' });
    pelvis.setLocalScale(1.8 * s, 1.4 * s, 1.1 * s);
    pelvis.setLocalPosition(0, 3.2 * s, 0);
    root.addChild(pelvis);

    const torso = primitive(this.app, 'box', skin, { name: 'torso' });
    torso.setLocalScale(2.2 * s, 2.6 * s, 1.3 * s);
    torso.setLocalPosition(0, 5.4 * s, 0);
    root.addChild(torso);

    const head = primitive(this.app, 'sphere', skin, { name: 'head' });
    head.setLocalScale(1.5 * s, 1.7 * s, 1.5 * s);
    head.setLocalPosition(0, 7.6 * s, 0.15 * s);
    root.addChild(head);

    for (const side of [-1, 1]) {
      const leg = primitive(this.app, 'capsule', skin, { name: 'leg' });
      leg.setLocalScale(0.7 * s, 2.4 * s, 0.7 * s);
      leg.setLocalPosition(0.55 * s * side, 1.4 * s, 0);
      root.addChild(leg);

      const arm = primitive(this.app, 'capsule', skin, { name: 'arm' });
      arm.setLocalScale(0.5 * s, 2.2 * s, 0.5 * s);
      arm.setLocalPosition(1.4 * s * side, 5.2 * s, 0.1 * s);
      arm.setLocalEulerAngles(0, 0, -12 * side);
      root.addChild(arm);
    }

    const nape = primitive(this.app, 'sphere', mats.nape().clone(), { name: 'nape', castShadows: false });
    nape.setLocalScale(0.55 * s, 0.4 * s, 0.35 * s);
    nape.setLocalPosition(0, 7.15 * s, -0.7 * s);
    root.addChild(nape);

    root.setPosition(x, 0, z);
    return root;
  }
}

export function spawnTitan(app: pc.Application, world: World, around: pc.Vec3, kind: TitanKind): Titan {
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 28 + Math.random() * 55;
    const x = clamp(around.x + Math.cos(ang) * rad, -WORLD_RADIUS + 20, WORLD_RADIUS - 20);
    const z = clamp(around.z + Math.sin(ang) * rad, -WORLD_RADIUS + 20, WORLD_RADIUS - 20);
    if (world.blockedAt(x, 2, z, 2)) continue;
    if (Math.hypot(x - around.x, z - around.z) < 18) continue;
    return new Titan(app, x, z, kind);
  }
  return new Titan(app, around.x + 30, around.z + 30, kind);
}

import * as pc from 'playcanvas';
import type { RemoteFlags } from '../config';
import type { PlayerStats } from '../types';
import { audio } from './audio';
import type { Input } from './input';
import { mats, primitive } from './materials';
import { clamp, lookYawPitch, raycastHookables } from './math';
import { SPAWN, WORLD_RADIUS, type World } from './world';

interface Hook {
  active: boolean;
  point: pc.Vec3;
  length: number;
}

const GRAVITY = -28;
const HOOK_RANGE = 92;
const MIN_ROPE = 3.5;
const GAS_ACCEL = 48;
const REEL_SPEED = 22;
const MAX_SPEED = 52;
const RUN_SPEED = 7.2;
const JUMP_SPEED = 8.5;
const AIR_DRAG = 0.55;
const GROUND_DRAG = 8;

export class Player {
  entity: pc.Entity;
  cam: pc.Entity;
  stats: PlayerStats;
  yaw = 0;
  pitch = -0.15;
  velocity = new pc.Vec3();
  onGround = false;
  scoutPass = false;

  private left: Hook = { active: false, point: new pc.Vec3(), length: 20 };
  private right: Hook = { active: false, point: new pc.Vec3(), length: 20 };
  private cableL: pc.Entity;
  private cableR: pc.Entity;
  private gasJet: pc.Entity;
  private napeHint = 0;
  private invuln = 0;
  private gasSfx = 0;
  private camSnap = true;
  private tmp = new pc.Vec3();
  private fwd = new pc.Vec3();
  private rightV = new pc.Vec3();
  private origin = new pc.Vec3();

  constructor(
    private app: pc.Application,
    private world: World,
    private input: Input,
    private flags: RemoteFlags,
  ) {
    this.stats = {
      hp: 100,
      maxHp: 100,
      gas: 100,
      maxGas: 100,
      blades: 50,
      maxBlades: 50,
      kills: 0,
      score: 0,
      wave: 1,
      alive: true,
    };

    this.entity = this.buildBody();
    this.cableL = this.makeCable();
    this.cableR = this.makeCable();
    this.gasJet = primitive(app, 'cone', mats.gas(), { name: 'gas-jet', castShadows: false });
    this.gasJet.setLocalScale(0.01, 0.01, 0.01);

    this.cam = new pc.Entity('camera');
    this.cam.addComponent('camera', {
      clearColor: new pc.Color(0.56, 0.61, 0.64),
      farClip: 420,
      fov: 68,
      priority: 1,
    });
    app.root.addChild(this.cam);

    this.respawn();
  }

  respawn(): void {
    this.entity.setPosition(SPAWN.x, SPAWN.y, SPAWN.z);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.2;
    lookYawPitch(this.yaw, this.pitch, this.fwd);
    this.stats.hp = this.stats.maxHp;
    this.stats.gas = this.stats.maxGas;
    this.stats.blades = this.stats.maxBlades;
    this.stats.alive = true;
    this.left.active = this.right.active = false;
    this.invuln = 1.2;
    this.camSnap = true;
    this.updateCamera(this.entity.getPosition());
  }

  destroy(): void {
    this.entity.destroy();
    this.cableL.destroy();
    this.cableR.destroy();
    this.gasJet.destroy();
    this.cam.destroy();
  }

  get position(): pc.Vec3 {
    return this.entity.getPosition();
  }

  get lookDir(): pc.Vec3 {
    return lookYawPitch(this.yaw, this.pitch, this.fwd);
  }

  hooked(): boolean {
    return this.left.active || this.right.active;
  }

  update(dt: number): void {
    if (!this.stats.alive) return;
    this.invuln = Math.max(0, this.invuln - dt);

    const look = this.input.consumeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -1.2, 1.2);
    lookYawPitch(this.yaw, this.pitch, this.fwd);
    this.rightV.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const pos = this.entity.getPosition();
    const ground = this.world.heightAt(pos.x, pos.z);
    const standing = pos.y <= ground + 1.85 && this.velocity.y <= 0.6;
    this.onGround = standing && !this.hooked();

    this.updateHooks(dt, pos);
    this.move(dt, pos, ground);
    this.refill(dt);
    this.stayInWorld(pos);
    this.entity.setPosition(pos);
    this.entity.setEulerAngles(0, this.yaw * pc.math.RAD_TO_DEG, 0);
    this.updateCables(pos);
    this.updateCamera(pos);
    this.napeHint = Math.max(0, this.napeHint - dt);
  }

  takeDamage(amount: number): void {
    if (this.invuln > 0 || !this.stats.alive) return;
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.invuln = 0.9;
    audio.hurt();
    if (this.stats.hp <= 0) {
      this.stats.alive = false;
      this.left.active = this.right.active = false;
      audio.death();
    }
  }

  slashReach(): { origin: pc.Vec3; dir: pc.Vec3; range: number } {
    const pos = this.entity.getPosition();
    this.origin.copy(pos).add(this.fwd);
    this.origin.y += 0.4;
    return { origin: this.origin, dir: this.fwd, range: 4.2 };
  }

  showNapeHint(): void {
    this.napeHint = 0.35;
  }

  napeHintActive(): boolean {
    return this.napeHint > 0;
  }

  private updateHooks(dt: number, pos: pc.Vec3): void {
    this.tryHook(this.input.state.hookL, this.left, pos, -1);
    this.tryHook(this.input.state.hookR, this.right, pos, 1);

    for (const hook of [this.left, this.right]) {
      if (!hook.active) continue;
      this.tmp.copy(hook.point).sub(pos);
      const dist = this.tmp.length();
      if (dist < 0.001) continue;
      this.tmp.mulScalar(1 / dist);

      if (this.input.state.gas && this.stats.gas > 0) {
        hook.length = Math.max(MIN_ROPE, hook.length - REEL_SPEED * dt);
      } else {
        hook.length = Math.max(hook.length, dist);
      }

      if (dist > hook.length) {
        pos.add(this.tmp.mulScalar(dist - hook.length));
        this.tmp.copy(hook.point).sub(pos).normalize();
        const along = this.velocity.dot(this.tmp);
        if (along < 0) this.velocity.add(this.tmp.mulScalar(-along));
      }

      const pull = 18 + (this.input.state.gas ? 10 : 0);
      this.velocity.add(this.tmp.copy(hook.point).sub(pos).normalize().mulScalar(pull * dt));
    }
  }

  private tryHook(held: boolean, hook: Hook, pos: pc.Vec3, side: number): void {
    if (!held) {
      hook.active = false;
      return;
    }
    if (hook.active) return;
    this.origin.copy(pos);
    this.origin.x += this.rightV.x * 0.35 * side;
    this.origin.y += 1.1;
    this.origin.z += this.rightV.z * 0.35 * side;
    const hit = raycastHookables(this.origin, this.fwd, this.world.hookables, HOOK_RANGE);
    if (!hit) return;
    hook.active = true;
    hook.point.copy(hit.point);
    hook.length = Math.max(MIN_ROPE, hit.dist);
    audio.hook();
  }

  private move(dt: number, pos: pc.Vec3, ground: number): void {
    const st = this.input.state;
    const airborne = !this.onGround || this.hooked();

    if (airborne) {
      this.velocity.y += GRAVITY * dt;
      if (st.gas && this.stats.gas > 0) {
        this.velocity.add(this.fwd.clone().mulScalar(GAS_ACCEL * dt));
        const drain = this.scoutPass ? 9 : 14;
        this.stats.gas = Math.max(0, this.stats.gas - drain * dt);
        this.gasSfx += dt;
        if (this.gasSfx > 0.12) {
          audio.gas();
          this.gasSfx = 0;
        }
      }
      this.velocity.x += (this.rightV.x * st.moveX + this.fwd.x * st.moveZ) * 10 * dt;
      this.velocity.z += (this.rightV.z * st.moveX + this.fwd.z * st.moveZ) * 10 * dt;
      this.velocity.lerp(this.velocity, this.tmp.set(0, this.velocity.y, 0), 1 - Math.exp(-AIR_DRAG * dt));
      const horiz = Math.hypot(this.velocity.x, this.velocity.z);
      const cap = st.gas ? MAX_SPEED : 28;
      if (horiz > cap) {
        const s = cap / horiz;
        this.velocity.x *= s;
        this.velocity.z *= s;
      }
    } else {
      const wishX = this.rightV.x * st.moveX + this.fwd.x * st.moveZ;
      const wishZ = this.rightV.z * st.moveX + this.fwd.z * st.moveZ;
      this.velocity.x = wishX * RUN_SPEED;
      this.velocity.z = wishZ * RUN_SPEED;
      this.velocity.y = 0;
      if (st.jump) this.velocity.y = JUMP_SPEED;
      this.velocity.x *= Math.exp(-GROUND_DRAG * dt * 0.05);
    }

    pos.x += this.velocity.x * dt;
    pos.y += this.velocity.y * dt;
    pos.z += this.velocity.z * dt;

    const nextGround = this.world.heightAt(pos.x, pos.z);
    if (pos.y < nextGround + 1.7) {
      if (this.world.blockedAt(pos.x, pos.y, pos.z, 0.35) && pos.y < nextGround + 1.2) {
        pos.x -= this.velocity.x * dt;
        pos.z -= this.velocity.z * dt;
        this.velocity.x *= 0.2;
        this.velocity.z *= 0.2;
      } else {
        pos.y = nextGround + 1.7;
        if (this.velocity.y < 0) this.velocity.y = 0;
      }
    }

    if (pos.y < 1.7) {
      pos.y = 1.7;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
  }

  private refill(dt: number): void {
    const regen = this.flags.gasRegenPerSec * (this.scoutPass ? 1.35 : 1);
    if (!this.input.state.gas) this.stats.gas = Math.min(this.stats.maxGas, this.stats.gas + regen * dt);
    const pos = this.entity.getPosition();
    for (const s of this.world.supplies) {
      if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.r && Math.abs(pos.y - s.y) < 3) {
        this.stats.gas = this.stats.maxGas;
        this.stats.blades = this.stats.maxBlades;
      }
    }
  }

  private stayInWorld(pos: pc.Vec3): void {
    const r = WORLD_RADIUS - 2;
    const m = Math.hypot(pos.x, pos.z);
    if (m > r) {
      const s = r / m;
      pos.x *= s;
      pos.z *= s;
      this.velocity.x *= 0.4;
      this.velocity.z *= 0.4;
    }
  }

  private updateCables(pos: pc.Vec3): void {
    this.placeCable(this.cableL, pos, this.left, -1);
    this.placeCable(this.cableR, pos, this.right, 1);
    const boosting = this.input.state.gas && this.stats.gas > 0 && !this.onGround;
    if (boosting) {
      this.gasJet.setLocalScale(0.45, 1.8, 0.45);
      this.gasJet.setPosition(pos.x - this.fwd.x * 0.6, pos.y, pos.z - this.fwd.z * 0.6);
      this.gasJet.lookAt(pos.x - this.fwd.x * 4, pos.y - 1, pos.z - this.fwd.z * 4);
    } else {
      this.gasJet.setLocalScale(0.01, 0.01, 0.01);
    }
  }

  private placeCable(ent: pc.Entity, pos: pc.Vec3, hook: Hook, side: number): void {
    if (!hook.active) {
      ent.enabled = false;
      return;
    }
    ent.enabled = true;
    const ox = pos.x + this.rightV.x * 0.28 * side;
    const oy = pos.y + 0.2;
    const oz = pos.z + this.rightV.z * 0.28 * side;
    const mx = (ox + hook.point.x) * 0.5;
    const my = (oy + hook.point.y) * 0.5;
    const mz = (oz + hook.point.z) * 0.5;
    const len = Math.hypot(hook.point.x - ox, hook.point.y - oy, hook.point.z - oz);
    ent.setPosition(mx, my, mz);
    ent.setLocalScale(0.04, 0.04, Math.max(0.05, len));
    ent.lookAt(hook.point);
  }

  private updateCamera(pos: pc.Vec3): void {
    const dist = 5.4;
    const height = 1.55;
    this.tmp.copy(this.fwd).mulScalar(-dist);
    this.tmp.y = Math.max(0.6, this.tmp.y + height);
    const camX = pos.x + this.tmp.x;
    const camY = pos.y + this.tmp.y;
    const camZ = pos.z + this.tmp.z;
    const cur = this.cam.getPosition();
    const t = this.camSnap ? 1 : 0.22;
    this.camSnap = false;
    this.cam.setPosition(lerp3(cur.x, camX, t), lerp3(cur.y, camY, t), lerp3(cur.z, camZ, t));
    this.cam.lookAt(pos.x + this.fwd.x * 2.2, pos.y + 1.15 + this.fwd.y * 2, pos.z + this.fwd.z * 2.2);
  }

  private buildBody(): pc.Entity {
    const root = new pc.Entity('scout');
    this.app.root.addChild(root);

    const torso = primitive(this.app, 'capsule', mats.scout(), { name: 'torso' });
    torso.setLocalScale(0.55, 0.85, 0.45);
    torso.setLocalPosition(0, 0, 0);
    root.addChild(torso);

    const cloak = primitive(this.app, 'cone', mats.cloak(), { name: 'cloak' });
    cloak.setLocalScale(0.9, 1.3, 0.55);
    cloak.setLocalPosition(0, -0.15, -0.15);
    cloak.setLocalEulerAngles(12, 0, 180);
    root.addChild(cloak);

    const head = primitive(this.app, 'sphere', mats.skin(), { name: 'head' });
    head.setLocalScale(0.38, 0.42, 0.38);
    head.setLocalPosition(0, 0.85, 0.02);
    root.addChild(head);

    for (const side of [-1, 1]) {
      const blade = primitive(this.app, 'box', mats.blade(), { name: 'blade' });
      blade.setLocalScale(0.05, 0.85, 0.08);
      blade.setLocalPosition(0.42 * side, 0.1, 0.15);
      blade.setLocalEulerAngles(8, 0, 12 * side);
      root.addChild(blade);
    }
    return root;
  }

  private makeCable(): pc.Entity {
    const c = primitive(this.app, 'box', mats.cable(), { name: 'cable', castShadows: false });
    c.enabled = false;
    return c;
  }
}

function lerp3(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

import * as pc from 'playcanvas';
import type { Difficulty, RemoteFlags } from '../config';
import { audio } from './audio';
import { Input } from './input';
import { Player } from './player';
import { Titan, spawnTitan } from './titan';
import { World } from './world';

export class Match {
  world: World;
  player: Player;
  titans: Titan[] = [];
  difficulty: Difficulty = 'normal';
  startedAt = performance.now();
  private slashCd = 0;
  private waveClearT = 0;
  private banner = '';
  private killFeed: string[] = [];
  onDeath?: () => void;
  onHud?: () => void;

  constructor(
    private app: pc.Application,
    private input: Input,
    private flags: RemoteFlags,
    world: World,
  ) {
    this.world = world;
    this.player = new Player(app, this.world, input, flags);
  }

  start(difficulty: Difficulty, tutorial: boolean): void {
    this.difficulty = difficulty;
    this.startedAt = performance.now();
    this.player.respawn();
    this.player.stats.kills = 0;
    this.player.stats.score = 0;
    this.player.stats.wave = tutorial ? 0 : 1;
    this.clearTitans();
    if (tutorial) {
      this.banner = 'TUTORIAL — WASD move · Q / E hook · Shift gas · Slash the nape';
      this.titans.push(new Titan(this.app, 8, 16, 'normal'));
    } else {
      this.spawnWave(1);
    }
  }

  setScoutPass(on: boolean): void {
    this.player.scoutPass = on;
  }

  bannerText(): string {
    return this.banner;
  }

  feed(): string[] {
    return this.killFeed;
  }

  update(dt: number): void {
    this.input.beginFrame();
    this.world.setDynamicHookables(
      this.living().map((t, i) => {
        const box = t.hookAabb();
        box.id = 50_000 + i;
        return box;
      }),
    );
    this.player.update(dt);
    this.slashCd = Math.max(0, this.slashCd - dt);

    if (this.input.state.slashPressed) this.trySlash();

    for (const titan of this.titans) titan.update(dt, this.player, this.world);
    this.updateNapeGlow();

    if (this.player.stats.alive && this.living().length === 0) {
      this.waveClearT += dt;
      if (this.waveClearT > 2.2) {
        this.waveClearT = 0;
        if (this.player.stats.wave === 0) {
          this.player.stats.wave = 1;
          this.banner = 'WAVE 1';
        } else {
          this.player.stats.wave += 1;
        }
        this.player.stats.gas = Math.min(this.player.stats.maxGas, this.player.stats.gas + 35);
        this.player.stats.blades = Math.min(this.player.stats.maxBlades, this.player.stats.blades + 18);
        this.spawnWave(this.player.stats.wave);
      } else if (this.living().length === 0) {
        this.banner = this.player.stats.wave === 0 ? 'Nape struck. Waves incoming…' : `WAVE ${this.player.stats.wave} CLEARED`;
      }
    } else {
      this.waveClearT = 0;
    }

    if (!this.player.stats.alive) this.onDeath?.();
    this.onHud?.();
  }

  destroy(): void {
    this.clearTitans();
    this.player.destroy();
  }

  private living(): Titan[] {
    return this.titans.filter((t) => t.alive);
  }

  private spawnWave(wave: number): void {
    this.clearTitans();
    const extra = this.difficulty === 'easy' ? 0 : this.difficulty === 'realism' ? 2 : 1;
    const count = Math.min(12, this.flags.titanBaseCount + extra + Math.floor((wave - 1) * 1.4));
    const pos = this.player.position;
    for (let i = 0; i < count; i++) {
      const aberrant = wave > 2 && Math.random() < 0.22 + wave * 0.04;
      this.titans.push(spawnTitan(this.app, this.world, pos, aberrant ? 'aberrant' : 'normal'));
    }
    this.banner = `WAVE ${wave} — ${count} titans`;
    setTimeout(() => {
      if (this.banner.startsWith(`WAVE ${wave}`)) this.banner = '';
    }, 3200);
  }

  private trySlash(): void {
    if (this.slashCd > 0 || !this.player.stats.alive) return;
    if (this.player.stats.blades <= 0) {
      this.pushFeed('Blades broken');
      return;
    }
    this.slashCd = 0.32;
    this.player.stats.blades -= 1;
    audio.slash();

    const { origin, dir, range } = this.player.slashReach();
    let hit = false;
    for (const titan of this.living()) {
      const nape = titan.napePosition();
      const to = new pc.Vec3().sub2(nape, origin);
      const dist = to.length();
      if (dist > range) continue;
      to.normalize();
      if (dir.dot(to) < 0.28) continue;
      const speed = this.player.velocity.length();
      const base = titan.kind === 'aberrant' ? 140 : 100;
      const bonus = Math.floor(speed * 12);
      const score = titan.kill(base + bonus + this.player.stats.wave * 15);
      this.player.stats.kills += 1;
      this.player.stats.score += score;
      this.pushFeed(`Nape cut · ${score}`);
      hit = true;
      break;
    }
    if (!hit) this.player.showNapeHint();
  }

  private updateNapeGlow(): void {
    const always = this.flags.napeGlowAlways;
    const { origin, dir, range } = this.player.slashReach();
    for (const titan of this.titans) {
      if (!titan.alive) continue;
      if (always) {
        titan.setNapeVisible(true);
        continue;
      }
      const nape = titan.napePosition();
      const dist = nape.distance(origin);
      const to = new pc.Vec3().sub2(nape, origin).normalize();
      titan.setNapeVisible(dist < range * 1.6 && dir.dot(to) > 0.15);
    }
  }

  private pushFeed(line: string): void {
    this.killFeed.unshift(line);
    this.killFeed = this.killFeed.slice(0, 4);
  }

  private clearTitans(): void {
    for (const t of this.titans) t.entity.destroy();
    this.titans = [];
  }
}

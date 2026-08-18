import type * as pc from 'playcanvas';
import { Color, Entity } from 'playcanvas';
import { GAME_NAME, type Difficulty } from './config';
import { initAuth, loginAnonymous, loginGoogle, sendPhoneCode, confirmPhoneCode, logout, onProfile, saveMatchStats, getProfile } from './services/auth';
import { initAnalytics, getFirebaseApp } from './services/firebase';
import { initRemoteConfig, getFlags } from './services/remoteConfig';
import { checkout } from './services/stripe';
import { submitRun, topRuns } from './services/leaderboard';
import { createApp } from './game/engine';
import { Input } from './game/input';
import { Match } from './game/match';
import { bindHud, paintHud, paintProfile } from './game/hud';
import { audio } from './game/audio';
import { closeModal, openModal, show } from './ui/shell';
import { World } from './game/world';

let app: pc.Application | null = null;
let world: World | null = null;
let match: Match | null = null;
let input: Input | null = null;
let menuCam: Entity | null = null;
let menuT = 0.6;
let running = false;
let paused = false;
let mode: 'tutorial' | 'waves' = 'waves';
let difficulty: Difficulty = 'normal';

async function boot(): Promise<void> {
  document.title = GAME_NAME;
  show('menu');
  await Promise.all([initAuth(), initRemoteConfig(), initAnalytics().catch(() => null), ensureApp()]);
  paintProfile(getProfile());
  onProfile(paintProfile);
  applyAbFlags();
  await refreshBoard();
  wireUi();
}

function applyAbFlags(): void {
  const flags = getFlags();
  document.body.dataset.ab = flags.abBucket;
  document.body.dataset.hud = flags.hudVariant;
  const tutBtn = document.getElementById('btn-tutorial');
  if (tutBtn) tutBtn.style.display = flags.tutorialEnabled ? '' : 'none';
  const badge = document.getElementById('ab-badge');
  if (badge) badge.textContent = `Trial ${flags.abBucket} · ${flags.hudVariant} HUD`;
}

function wireUi(): void {
  const canvas = document.getElementById('application') as HTMLCanvasElement;
  canvas.addEventListener('click', () => {
    if (running && !paused) input?.requestLock(canvas);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.getElementById('btn-tutorial')?.addEventListener('click', () => startMatch('tutorial', difficulty));
  document.getElementById('btn-play')?.addEventListener('click', () => startMatch('waves', difficulty));
  document.getElementById('btn-endless')?.addEventListener('click', () => startMatch('waves', difficulty));
  document.getElementById('btn-auth')?.addEventListener('click', () => openModal('auth'));
  document.getElementById('btn-shop')?.addEventListener('click', () => openModal('shop'));
  document.getElementById('btn-settings')?.addEventListener('click', () => openModal('settings'));
  document.getElementById('btn-profile')?.addEventListener('click', () => openModal('profile'));
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.getAttribute('data-close') as 'auth'));
  });

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      if (!getFirebaseApp()) await loginAnonymous();
      else await loginGoogle();
      closeModal('auth');
    } catch (err) {
      setAuthError(err);
    }
  });
  document.getElementById('btn-guest')?.addEventListener('click', async () => {
    await loginAnonymous();
    closeModal('auth');
  });
  document.getElementById('btn-phone-send')?.addEventListener('click', async () => {
    const phone = (document.getElementById('phone-input') as HTMLInputElement).value.trim();
    try {
      await sendPhoneCode(phone, 'recaptcha-host');
      document.getElementById('phone-step-2')?.classList.add('open');
    } catch (err) {
      setAuthError(err);
    }
  });
  document.getElementById('btn-phone-confirm')?.addEventListener('click', async () => {
    const code = (document.getElementById('phone-code') as HTMLInputElement).value.trim();
    try {
      await confirmPhoneCode(code);
      closeModal('auth');
    } catch (err) {
      setAuthError(err);
    }
  });
  document.getElementById('btn-logout')?.addEventListener('click', () => logout());

  document.getElementById('btn-buy-pass')?.addEventListener('click', () => void checkout('scout_pass'));
  document.getElementById('btn-buy-gas')?.addEventListener('click', () => void checkout('gas_pack'));

  document.querySelectorAll('[data-diff]').forEach((el) => {
    el.addEventListener('click', () => {
      difficulty = el.getAttribute('data-diff') as Difficulty;
      document.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('active', b === el));
    });
  });

  document.getElementById('sens')?.addEventListener('input', (e) => {
    if (input) input.sensitivity = Number((e.target as HTMLInputElement).value) * 0.0008;
  });
  document.getElementById('invert-y')?.addEventListener('change', (e) => {
    if (input) input.invertY = (e.target as HTMLInputElement).checked;
  });
  document.getElementById('vol')?.addEventListener('input', (e) => {
    audio.setVolume(Number((e.target as HTMLInputElement).value));
  });

  document.getElementById('btn-resume')?.addEventListener('click', resume);
  document.getElementById('btn-menu')?.addEventListener('click', toMenu);
  document.getElementById('btn-retry')?.addEventListener('click', () => startMatch(mode, difficulty));
  document.getElementById('btn-dead-menu')?.addEventListener('click', toMenu);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && running) {
      if (paused) resume();
      else pause();
    }
  });
}

async function ensureApp(): Promise<void> {
  if (app) return;
  const canvas = document.getElementById('application') as HTMLCanvasElement;
  app = await createApp(canvas);
  input = new Input();
  input.attach(canvas);
  world = new World(app);
  world.build();
  menuCam = new Entity('menu-cam');
  menuCam.addComponent('camera', {
    clearColor: new Color(0.56, 0.61, 0.64),
    farClip: 420,
    fov: 54,
    priority: 0,
  });
  app.root.addChild(menuCam);
  orbitMenu(0);
  app.on('update', (dt: number) => {
    if (running && match && !paused) match.update(Math.min(dt, 0.05));
    else if (menuCam?.enabled) orbitMenu(dt);
  });
}

function orbitMenu(dt: number): void {
  if (!menuCam) return;
  menuT += dt * 0.07;
  const r = 88;
  menuCam.setPosition(Math.sin(menuT) * r, 32, Math.cos(menuT) * r);
  menuCam.lookAt(0, 10, 8);
}

async function startMatch(next: 'tutorial' | 'waves', diff: Difficulty): Promise<void> {
  mode = next;
  difficulty = diff;
  const canvas = document.getElementById('application') as HTMLCanvasElement;
  await ensureApp();
  match?.destroy();
  if (menuCam) menuCam.enabled = false;
  const flags = getFlags();
  match = new Match(app!, input!, flags, world!);
  match.setScoutPass(Boolean(getProfile()?.scoutPass));
  match.onDeath = onPlayerDeath;
  bindHud(match, flags);
  match.start(diff, next === 'tutorial');
  running = true;
  paused = false;
  show('hud');
  paintHud(match, flags);
  input!.requestLock(canvas);
  audio.ui();
}

function pause(): void {
  if (!running) return;
  paused = true;
  document.exitPointerLock();
  openModal('pause');
}

function resume(): void {
  paused = false;
  closeModal('pause');
  const canvas = document.getElementById('application') as HTMLCanvasElement;
  input?.requestLock(canvas);
}

function toMenu(): void {
  running = false;
  paused = false;
  document.exitPointerLock();
  closeModal('pause');
  closeModal('dead');
  match?.destroy();
  match = null;
  if (menuCam) menuCam.enabled = true;
  show('menu');
}

function onPlayerDeath(): void {
  if (!match || !running) return;
  running = false;
  document.exitPointerLock();
  const s = match.player.stats;
  const durationSec = (performance.now() - match.startedAt) / 1000;
  void saveMatchStats(s.kills, s.score);
  void submitRun({
    kills: s.kills,
    score: s.score,
    wave: s.wave,
    durationSec,
    difficulty,
  });
  const deadScore = document.getElementById('dead-score');
  const deadKills = document.getElementById('dead-kills');
  if (deadScore) deadScore.textContent = String(s.score);
  if (deadKills) deadKills.textContent = String(s.kills);
  openModal('dead');
}

function setAuthError(err: unknown): void {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = err instanceof Error ? err.message : 'Sign-in failed';
}

async function refreshBoard(): Promise<void> {
  const rows = await topRuns();
  const el = document.getElementById('leaderboard');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<li>No live scores yet — play a run to post one.</li>';
    return;
  }
  el.innerHTML = rows
    .map((r, i) => `<li><span>${i + 1}. ${r.name}</span><b>${r.score}</b></li>`)
    .join('');
}

void boot();

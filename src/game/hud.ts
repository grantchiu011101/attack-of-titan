import type { RemoteFlags } from '../config';
import type { ScoutProfile } from '../types';
import type { Match } from './match';

export function bindHud(match: Match, flags: RemoteFlags): void {
  const root = document.getElementById('hud');
  if (root) root.dataset.variant = flags.hudVariant;
  match.onHud = () => paintHud(match, flags);
}

export function paintHud(match: Match, flags: RemoteFlags): void {
  const s = match.player.stats;
  setBar('hp-bar', s.hp / s.maxHp);
  setBar('gas-bar', s.gas / s.maxGas);
  setBar('blade-bar', s.blades / s.maxBlades);
  setText('hp-val', `${Math.ceil(s.hp)}`);
  setText('gas-val', `${Math.ceil(s.gas)}`);
  setText('blade-val', `${s.blades}`);
  setText('kill-val', `${s.kills}`);
  setText('score-val', `${s.score}`);
  setText('wave-val', s.wave === 0 ? 'DRILL' : `WAVE ${s.wave}`);
  setText('banner', match.bannerText());
  const feed = document.getElementById('kill-feed');
  if (feed) feed.innerHTML = match.feed().map((l) => `<li>${escapeHtml(l)}</li>`).join('');

  const cross = document.getElementById('crosshair');
  if (cross) {
    cross.classList.toggle('nape', match.player.napeHintActive());
    cross.classList.toggle('miss', match.player.missFlash > 0);
  }
  setPip('hook-l', match.player.leftHooked, match.player.hookReadyL, match.player.missFlash > 0 && !match.player.leftHooked);
  setPip('hook-r', match.player.rightHooked, match.player.hookReadyR, match.player.missFlash > 0 && !match.player.rightHooked);
  const hint = document.getElementById('lock-hint');
  if (hint) hint.textContent = match.player.lockHint;
  const hud = document.getElementById('hud');
  if (hud) hud.dataset.variant = flags.hudVariant;
}

export function paintProfile(profile: ScoutProfile | null): void {
  const name = profile?.displayName || 'Guest Scout';
  const pass = profile?.scoutPass ? 'Scout Pass' : 'Recruit';
  document.querySelectorAll('[data-scout-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-scout-rank]').forEach((el) => {
    el.textContent = pass;
  });
  document.querySelectorAll('[data-scout-kills]').forEach((el) => {
    el.textContent = String(profile?.titanKills ?? 0);
  });
  document.querySelectorAll('[data-scout-best]').forEach((el) => {
    el.textContent = String(profile?.bestScore ?? 0);
  });
  const avatar = document.getElementById('scout-avatar') as HTMLImageElement | null;
  if (avatar) {
    avatar.src = profile?.photoURL || '';
    avatar.style.display = profile?.photoURL ? 'block' : 'none';
  }
}

function setBar(id: string, t: number): void {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(1, t)) * 100}%`;
}

function setPip(id: string, locked: boolean, ready: boolean, miss: boolean): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('locked', locked);
  el.classList.toggle('ready', ready && !locked);
  el.classList.toggle('miss', miss && !locked && !ready);
}

function setText(id: string, v: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

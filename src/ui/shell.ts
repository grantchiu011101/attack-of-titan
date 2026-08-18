export type Overlay =
  | 'menu'
  | 'hud'
  | 'pause'
  | 'dead'
  | 'auth'
  | 'shop'
  | 'settings'
  | 'profile';

const ALL: Overlay[] = ['menu', 'hud', 'pause', 'dead', 'auth', 'shop', 'settings', 'profile'];

export function show(name: Overlay): void {
  for (const id of ALL) {
    const el = document.getElementById(`screen-${id}`);
    if (!el) continue;
    const on = id === name || (name === 'hud' && id === 'hud');
    el.classList.toggle('open', id === name);
    el.setAttribute('aria-hidden', id === name ? 'false' : 'true');
  }
  document.getElementById('mobile-controls')?.classList.toggle('open', name === 'hud');
  document.body.dataset.screen = name;
}

export function hideModals(): void {
  for (const id of ['auth', 'shop', 'settings', 'profile', 'pause', 'dead'] as Overlay[]) {
    document.getElementById(`screen-${id}`)?.classList.remove('open');
  }
}

export function openModal(name: Overlay): void {
  document.getElementById(`screen-${name}`)?.classList.add('open');
}

export function closeModal(name: Overlay): void {
  document.getElementById(`screen-${name}`)?.classList.remove('open');
}

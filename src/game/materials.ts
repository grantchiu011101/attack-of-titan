import * as pc from 'playcanvas';

const cache = new Map<string, pc.StandardMaterial>();

function make(key: string, build: (m: pc.StandardMaterial) => void): pc.StandardMaterial {
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new pc.StandardMaterial();
  build(m);
  m.update();
  cache.set(key, m);
  return m;
}

export function applyMat(entity: pc.Entity, mat: pc.StandardMaterial): void {
  const render = entity.render;
  if (!render) return;
  for (const mi of render.meshInstances) {
    mi.material = mat;
  }
}

export const mats = {
  grass: () =>
    make('grass', (m) => {
      m.diffuse.set(0.3, 0.4, 0.22);
      m.specular.set(0.04, 0.04, 0.04);
      m.gloss = 0.12;
      m.useLighting = true;
      m.useMetalness = false;
    }),
  dirt: () =>
    make('dirt', (m) => {
      m.diffuse.set(0.32, 0.26, 0.18);
      m.useLighting = true;
    }),
  stone: () =>
    make('stone', (m) => {
      m.diffuse.set(0.55, 0.5, 0.44);
      m.specular.set(0.1, 0.1, 0.1);
      m.gloss = 0.22;
      m.useLighting = true;
    }),
  wall: () =>
    make('wall', (m) => {
      m.diffuse.set(0.62, 0.56, 0.48);
      m.specular.set(0.08, 0.08, 0.08);
      m.gloss = 0.16;
      m.useLighting = true;
    }),
  roof: () =>
    make('roof', (m) => {
      m.diffuse.set(0.55, 0.22, 0.16);
      m.specular.set(0.12, 0.08, 0.06);
      m.gloss = 0.28;
      m.useLighting = true;
    }),
  wood: () =>
    make('wood', (m) => {
      m.diffuse.set(0.28, 0.18, 0.1);
      m.useLighting = true;
    }),
  foliage: () =>
    make('foliage', (m) => {
      m.diffuse.set(0.16, 0.32, 0.14);
      m.specular.set(0.03, 0.04, 0.03);
      m.gloss = 0.14;
      m.useLighting = true;
    }),
  bark: () =>
    make('bark', (m) => {
      m.diffuse.set(0.22, 0.14, 0.08);
      m.useLighting = true;
    }),
  scout: () =>
    make('scout', (m) => {
      m.diffuse.set(0.18, 0.16, 0.12);
      m.useLighting = true;
    }),
  cloak: () =>
    make('cloak', (m) => {
      m.diffuse.set(0.12, 0.22, 0.14);
      m.useLighting = true;
    }),
  skin: () =>
    make('skin', (m) => {
      m.diffuse.set(0.72, 0.56, 0.46);
      m.specular.set(0.12, 0.1, 0.09);
      m.gloss = 0.35;
      m.useLighting = true;
    }),
  titan: () =>
    make('titan', (m) => {
      m.diffuse.set(0.78, 0.64, 0.52);
      m.specular.set(0.08, 0.06, 0.05);
      m.gloss = 0.2;
      m.useLighting = true;
    }),
  titanAberrant: () =>
    make('titanAberrant', (m) => {
      m.diffuse.set(0.72, 0.42, 0.38);
      m.useLighting = true;
    }),
  nape: () =>
    make('nape', (m) => {
      m.diffuse.set(0.85, 0.12, 0.1);
      m.emissive.set(0.55, 0.05, 0.04);
      m.useLighting = false;
    }),
  blade: () =>
    make('blade', (m) => {
      m.diffuse.set(0.75, 0.78, 0.82);
      m.specular.set(0.4, 0.4, 0.4);
      m.gloss = 0.72;
    }),
  cable: () =>
    make('cable', (m) => {
      m.diffuse.set(0.08, 0.08, 0.08);
      m.useLighting = false;
    }),
  gas: () =>
    make('gas', (m) => {
      m.diffuse.set(0.75, 0.82, 0.7);
      m.emissive.set(0.35, 0.42, 0.3);
      m.opacity = 0.45;
      m.blendType = pc.BLEND_NORMAL;
      m.useLighting = false;
    }),
  window: () =>
    make('window', (m) => {
      m.diffuse.set(0.12, 0.14, 0.16);
      m.emissive.set(0.18, 0.14, 0.08);
    }),
  supply: () =>
    make('supply', (m) => {
      m.diffuse.set(0.85, 0.72, 0.2);
      m.emissive.set(0.4, 0.32, 0.05);
    }),
};

export function primitive(
  app: pc.Application,
  type: 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'plane',
  mat: pc.StandardMaterial,
  opts?: { name?: string; castShadows?: boolean; receiveShadows?: boolean },
): pc.Entity {
  const e = new pc.Entity(opts?.name || type);
  e.addComponent('render', {
    type,
    castShadows: opts?.castShadows ?? true,
    receiveShadows: opts?.receiveShadows ?? true,
  });
  applyMat(e, mat);
  app.root.addChild(e);
  return e;
}

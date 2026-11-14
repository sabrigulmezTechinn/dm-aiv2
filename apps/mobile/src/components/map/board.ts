import * as THREE from 'three';
import type { GameMap, PropKind, Token } from '@dmai/shared';

export interface BoardData {
  map: GameMap;
  fog: string[] | null;
  tokens: Token[];
  moveTargets: { x: number; y: number }[];
  targetIds: string[];
  focusId: string | null;
}

export interface BoardCallbacks {
  onTileTap(x: number, y: number): void;
  onTokenTap(id: string): void;
}

type Palette = { floor: number; floorAlt: number; wall: number; wallTop: number; door: number; grout: number };

const PALETTES: Record<GameMap['kind'], Palette> = {
  tavern: { floor: 0x8a5a36, floorAlt: 0x7a4e2e, wall: 0xc9b48c, wallTop: 0x5a3a22, door: 0x6b4423, grout: 0x241810 },
  dungeon: { floor: 0x6f6b65, floorAlt: 0x625e58, wall: 0x4c4741, wallTop: 0x5b5650, door: 0x5c3f25, grout: 0x141210 },
  cellar: { floor: 0x6a5f55, floorAlt: 0x5f554c, wall: 0x54493f, wallTop: 0x62574c, door: 0x5c3f25, grout: 0x15110e },
  cave: { floor: 0x6b5541, floorAlt: 0x5f4b39, wall: 0x3e322a, wallTop: 0x4a3d33, door: 0x5c3f25, grout: 0x120e0b },
  battlefield: { floor: 0x547d3c, floorAlt: 0x4b7335, wall: 0x3a5a2a, wallTop: 0x3a5a2a, door: 0x5c3f25, grout: 0x1b2412 },
};

const TILE_COLORS: Record<string, number> = {
  ',': 0x7a5f3e,
  '"': 0x547d3c,
  '~': 0x2f5f8a,
  '>': 0x3d3935,
  '<': 0x5d5953,
};

const WALL_H = 1.35;
const TMP = new THREE.Object3D();
const COLOR = new THREE.Color();

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function std(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...opts });
}

// ---------------------------------------------------------------------------
// Props as small low-poly models

type PropModel = { group: THREE.Group; mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color; emissive?: THREE.Color }[]; light?: { color: number; radius: number } };

function propModel(kind: PropKind, seed: number): PropModel {
  const g = new THREE.Group();
  const mats: PropModel['mats'] = [];
  const add = (geo: THREE.BufferGeometry, color: number, pos: [number, number, number], opts: Partial<THREE.MeshStandardMaterialParameters> = {}, rot?: [number, number, number]) => {
    const mat = std(color, opts);
    mats.push({ mat, base: mat.color.clone(), emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive as number) : undefined });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const wood = 0x7b5230;
  const darkWood = 0x4d321d;
  const stone = 0x8a857c;
  let light: PropModel['light'];
  switch (kind) {
    case 'table':
      add(new THREE.BoxGeometry(0.86, 0.08, 0.86), wood, [0, 0.46, 0]);
      for (const [x, z] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]] as const) add(new THREE.BoxGeometry(0.08, 0.44, 0.08), darkWood, [x, 0.22, z]);
      if (seed > 0.5) add(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 6), 0xb8b0a0, [0.15, 0.57, 0.1]);
      break;
    case 'chair':
      add(new THREE.BoxGeometry(0.42, 0.06, 0.42), wood, [0, 0.27, 0]);
      add(new THREE.BoxGeometry(0.42, 0.42, 0.06), wood, [0, 0.48, -0.18]);
      for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const) add(new THREE.BoxGeometry(0.05, 0.26, 0.05), darkWood, [x, 0.13, z]);
      break;
    case 'stool':
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), wood, [0, 0.36, 0]);
      add(new THREE.CylinderGeometry(0.05, 0.08, 0.34, 6), darkWood, [0, 0.17, 0]);
      break;
    case 'bar_counter':
      add(new THREE.BoxGeometry(1.0, 0.62, 0.62), darkWood, [0, 0.31, 0]);
      add(new THREE.BoxGeometry(1.02, 0.07, 0.7), 0x9a6a3c, [0, 0.65, 0]);
      if (seed > 0.4) add(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 6), 0x3a6b4a, [seed - 0.5, 0.76, 0.05], { roughness: 0.3 });
      break;
    case 'fireplace':
      add(new THREE.BoxGeometry(1.0, 1.1, 0.7), 0x6d665e, [0, 0.55, -0.1]);
      add(new THREE.BoxGeometry(0.62, 0.5, 0.3), 0x1a1310, [0, 0.27, 0.12]);
      add(new THREE.ConeGeometry(0.18, 0.36, 5), 0xff7a1a, [0, 0.2, 0.12], { emissive: 0xff5a00, emissiveIntensity: 1.8 });
      light = { color: 0xff8a3c, radius: 6 };
      break;
    case 'barrel':
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 10), 0x8a5a33, [0, 0.35, 0]);
      add(new THREE.TorusGeometry(0.31, 0.025, 4, 12), 0x3a3633, [0, 0.18, 0], {}, [Math.PI / 2, 0, 0]);
      add(new THREE.TorusGeometry(0.31, 0.025, 4, 12), 0x3a3633, [0, 0.52, 0], {}, [Math.PI / 2, 0, 0]);
      break;
    case 'crate':
      add(new THREE.BoxGeometry(0.66, 0.6, 0.66), 0x9a7448, [0, 0.3, 0], {}, [0, seed * 0.6, 0]);
      add(new THREE.BoxGeometry(0.7, 0.06, 0.7), 0x6e4f2e, [0, 0.6, 0], {}, [0, seed * 0.6, 0]);
      break;
    case 'chest':
      add(new THREE.BoxGeometry(0.72, 0.38, 0.48), 0x6b4222, [0, 0.19, 0]);
      add(new THREE.CylinderGeometry(0.24, 0.24, 0.72, 8, 1, false, 0, Math.PI), 0x7d4f2a, [0, 0.38, 0], {}, [0, 0, Math.PI / 2]);
      add(new THREE.BoxGeometry(0.1, 0.12, 0.05), 0xd6a84c, [0, 0.38, 0.25], { metalness: 0.6, roughness: 0.3 });
      break;
    case 'bed':
      add(new THREE.BoxGeometry(0.8, 0.3, 1.0), 0x6b4423, [0, 0.15, 0]);
      add(new THREE.BoxGeometry(0.72, 0.1, 0.9), 0xb9a98a, [0, 0.35, 0]);
      add(new THREE.BoxGeometry(0.5, 0.1, 0.22), 0xe8e0cc, [0, 0.42, -0.32]);
      break;
    case 'altar':
      add(new THREE.BoxGeometry(1.0, 0.7, 0.6), 0x5b5852, [0, 0.35, 0]);
      add(new THREE.BoxGeometry(1.1, 0.08, 0.7), 0x7a766e, [0, 0.72, 0]);
      add(new THREE.ConeGeometry(0.06, 0.14, 5), 0x9cff9c, [0.32, 0.84, 0], { emissive: 0x44ff66, emissiveIntensity: 1.5 });
      add(new THREE.ConeGeometry(0.06, 0.14, 5), 0x9cff9c, [-0.32, 0.84, 0], { emissive: 0x44ff66, emissiveIntensity: 1.5 });
      light = { color: 0x77ff99, radius: 4 };
      break;
    case 'statue':
      add(new THREE.BoxGeometry(0.62, 0.3, 0.62), stone, [0, 0.15, 0]);
      add(new THREE.CylinderGeometry(0.16, 0.24, 0.85, 7), 0x9a958b, [0, 0.72, 0]);
      add(new THREE.SphereGeometry(0.15, 7, 5), 0x9a958b, [0, 1.25, 0]);
      break;
    case 'pillar':
      add(new THREE.CylinderGeometry(0.28, 0.32, 1.4, 8), stone, [0, 0.7, 0]);
      add(new THREE.BoxGeometry(0.72, 0.1, 0.72), 0x6f6a62, [0, 1.42, 0]);
      add(new THREE.BoxGeometry(0.72, 0.1, 0.72), 0x6f6a62, [0, 0.05, 0]);
      break;
    case 'rubble':
      for (let i = 0; i < 4; i++) add(new THREE.DodecahedronGeometry(0.1 + hash(i, seed * 100) * 0.1, 0), 0x6a655e, [(hash(i, 1) - 0.5) * 0.6, 0.08, (hash(i, 2) - 0.5) * 0.6]);
      break;
    case 'torch':
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 5), 0x4d321d, [0, 0.9, -0.38], {}, [0.4, 0, 0]);
      add(new THREE.ConeGeometry(0.08, 0.2, 5), 0xffb347, [0, 1.15, -0.3], { emissive: 0xff8a00, emissiveIntensity: 2 });
      light = { color: 0xffa04a, radius: 5 };
      break;
    case 'tree': {
      const s = 0.8 + seed * 0.5;
      add(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 0.6 * s, 6), 0x5a3d26, [0, 0.3 * s, 0]);
      add(new THREE.ConeGeometry(0.48 * s, 0.9 * s, 7), seed > 0.5 ? 0x2f5a2a : 0x3a6a30, [0, 0.95 * s, 0]);
      add(new THREE.ConeGeometry(0.36 * s, 0.7 * s, 7), 0x3f7536, [0, 1.35 * s, 0]);
      break;
    }
    case 'rock':
      add(new THREE.DodecahedronGeometry(0.34, 0), 0x7d7870, [0, 0.24, 0], {}, [seed, seed * 2, 0]);
      break;
    case 'bookshelf':
      add(new THREE.BoxGeometry(0.9, 1.2, 0.36), darkWood, [0, 0.6, -0.25]);
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.76, 0.24, 0.26), [0x7a2e2e, 0x2e4a7a, 0x4a6a2e][i]!, [0, 0.3 + i * 0.35, -0.2]);
      break;
    case 'bones':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5), 0xe6dfcc, [0, 0.04, 0], {}, [0, seed * 3, Math.PI / 2]);
      add(new THREE.SphereGeometry(0.1, 6, 5), 0xe6dfcc, [0.18, 0.08, 0.1]);
      break;
    case 'campfire':
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), 0x4d321d, [0, 0.05, 0], {}, [Math.PI / 2, (i * Math.PI) / 3, 0]);
      add(new THREE.ConeGeometry(0.2, 0.45, 6), 0xff8a2a, [0, 0.25, 0], { emissive: 0xff6a00, emissiveIntensity: 2 });
      light = { color: 0xff7a2c, radius: 6 };
      break;
  }
  return { group: g, mats, light };
}

// ---------------------------------------------------------------------------
// Tokens as miniatures

function labelTexture(text: string, bg = 'rgba(15,12,10,0.78)', fg = '#f1e7d6'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px system-ui, sans-serif';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = bg;
  const x = (256 - w) / 2;
  g.beginPath();
  g.roundRect(x, 10, w, 44, 14);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33, 230);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hpTexture(hp: number, max: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fillRect(0, 0, 128, 16);
  const pct = max > 0 ? Math.max(0, hp / max) : 0;
  g.fillStyle = pct > 0.5 ? '#6aa86f' : pct > 0.25 ? '#d6a84c' : '#c84a3c';
  g.fillRect(2, 2, 124 * pct, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface TokenObj {
  group: THREE.Group;
  body: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  label: THREE.Sprite;
  hp?: THREE.Sprite;
  key: string;
  to: THREE.Vector3;
}

function makeToken(t: Token): TokenObj {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const color = new THREE.Color(t.color);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.08, 20), std(0x1c1713));
  base.position.y = 0.04;
  base.castShadow = true;
  const ringMat = std(t.kind === 'player' ? 0xd6a84c : t.kind === 'monster' ? 0xb33a3a : 0xcfc2a0, { emissive: 0x000000 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 24), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.085;
  const bodyMat = std(color.getHex(), { roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 0.55, 8), bodyMat);
  torso.position.y = 0.36;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), std(t.kind === 'monster' ? color.clone().multiplyScalar(0.7).getHex() : 0xe2c3a0, { roughness: 0.7 }));
  head.position.y = 0.74;
  head.castShadow = true;
  body.add(torso, head);
  if (t.kind === 'monster') {
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), std(0xe8dcc0));
      horn.position.set(0.08 * s, 0.86, 0);
      horn.rotation.z = -0.4 * s;
      body.add(horn);
    }
  }
  if (t.kind === 'player') {
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 8, 1, true, Math.PI * 0.6, Math.PI * 0.8), std(color.clone().multiplyScalar(0.6).getHex(), { side: THREE.DoubleSide }));
    cape.position.set(0, 0.36, -0.03);
    body.add(cape);
  }
  group.add(base, ring, body);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(t.name), depthTest: false, transparent: true }));
  label.scale.set(1.5, 0.375, 1);
  label.position.y = 1.15;
  label.renderOrder = 10;
  group.add(label);
  const obj: TokenObj = { group, body, ring, ringMat, label, key: '', to: new THREE.Vector3() };
  return obj;
}

// ---------------------------------------------------------------------------

export class Board {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private hemi = new THREE.HemisphereLight(0xfff1dd, 0x2a2018, 0.8);
  private sun = new THREE.DirectionalLight(0xffe6c4, 1.0);
  private playerLight = new THREE.PointLight(0xffb060, 0, 9, 1.6);
  private mapGroup = new THREE.Group();
  private propsGroup = new THREE.Group();
  private wallsGroup = new THREE.Group();
  private tokenGroup = new THREE.Group();
  private highlightMesh: THREE.InstancedMesh | null = null;
  private floorMesh: THREE.InstancedMesh | null = null;
  private wallMesh: THREE.InstancedMesh | null = null;
  private floorCells: { x: number; y: number; color: THREE.Color }[] = [];
  private wallCells: { x: number; y: number; color: THREE.Color }[] = [];
  private props: { x: number; y: number; model: PropModel; lightObj?: THREE.PointLight }[] = [];
  private tokens = new Map<string, TokenObj>();
  private mapKey = '';
  private data: BoardData | null = null;
  private width = 0;
  private height = 0;
  private modeT = 0; // 0 = 3D, 1 = 2D
  private modeTarget = 0;
  private zoom = 1;
  private target = new THREE.Vector3();
  private lastPan = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; t: number; moved: boolean } | null = null;
  private pinchDist = 0;
  private raycaster = new THREE.Raycaster();
  private timer = new THREE.Timer();
  private cutKey = '';
  private resizeObs: ResizeObserver | null = null;
  private disposed = false;

  constructor(private container: HTMLElement, private cb: BoardCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);
    this.scene.background = new THREE.Color(0x0d0a08);
    this.scene.fog = new THREE.Fog(0x0d0a08, 30, 70);
    this.sun.position.set(-8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.playerLight, this.mapGroup, this.tokenGroup);
    this.mapGroup.add(this.wallsGroup, this.propsGroup);
    this.bindInput(canvas);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setMode(mode: '2d' | '3d', instant = false) {
    this.modeTarget = mode === '2d' ? 1 : 0;
    if (instant) this.modeT = this.modeTarget;
    this.sun.castShadow = mode === '3d';
  }

  update(data: BoardData) {
    const key = `${data.map.id}:${data.map.width}x${data.map.height}:${data.map.tiles.join('')}:${data.map.props.length}`;
    const first = !this.data;
    this.data = data;
    if (key !== this.mapKey) {
      const sameMap = this.mapKey.startsWith(`${data.map.id}:`);
      this.mapKey = key;
      this.buildMap(data.map);
      if (!sameMap) this.snapToFocus();
    }
    this.applyFog();
    this.syncTokens(first);
    this.syncHighlights();
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs?.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // -------------------------------------------------------------------------

  private world(x: number, y: number) {
    const m = this.data!.map;
    return new THREE.Vector3(x - m.width / 2 + 0.5, 0, y - m.height / 2 + 0.5);
  }

  private clearMap() {
    for (const child of [...this.wallsGroup.children, ...this.propsGroup.children]) {
      child.parent?.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    }
    for (const mesh of [this.floorMesh, this.highlightMesh]) {
      if (mesh) {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
    for (const p of this.props) if (p.lightObj) this.scene.remove(p.lightObj);
    const base = this.mapGroup.getObjectByName('base');
    if (base) this.mapGroup.remove(base);
    this.floorMesh = null;
    this.highlightMesh = null;
    this.wallMesh = null;
    this.props = [];
    this.floorCells = [];
    this.wallCells = [];
  }

  private buildMap(map: GameMap) {
    this.clearMap();
    const pal = PALETTES[map.kind];
    const outdoor = map.kind === 'battlefield';
    this.scene.background = new THREE.Color(outdoor ? 0x1b2414 : 0x0d0a08);
    (this.scene.fog as THREE.Fog).color.set(outdoor ? 0x1b2414 : 0x0d0a08);
    // Base plate under tiles shows through the gaps as grout.
    const base = new THREE.Mesh(new THREE.BoxGeometry(map.width + 1, 0.2, map.height + 1), std(pal.grout));
    base.position.y = -0.2;
    base.receiveShadow = true;
    base.name = 'base';
    this.mapGroup.add(base);

    const floors: { x: number; y: number; color: THREE.Color; h: number; gap: number }[] = [];
    const walls: { x: number; y: number; color: THREE.Color }[] = [];
    for (let y = 0; y < map.height; y++) {
      const row = map.tiles[y]!;
      for (let x = 0; x < map.width; x++) {
        const ch = row[x]!;
        if (ch === ' ') continue;
        const r = hash(x, y);
        if (ch === '#') {
          walls.push({ x, y, color: new THREE.Color(pal.wall).multiplyScalar(0.92 + r * 0.14) });
          continue;
        }
        let color = TILE_COLORS[ch] ?? (r > 0.5 ? pal.floor : pal.floorAlt);
        if (ch === '.' || ch === '=' || ch === '+' || ch === '/') color = map.kind === 'tavern' ? (x % 2 ? pal.floor : pal.floorAlt) : r > 0.5 ? pal.floor : pal.floorAlt;
        const wood = map.kind === 'tavern' && ch !== '.';
        floors.push({
          x,
          y,
          color: new THREE.Color(color).multiplyScalar(0.9 + r * 0.18),
          h: ch === '~' ? -0.12 : wood ? 0.02 : 0.015 + r * 0.06,
          gap: wood ? 0.995 : ch === '"' || ch === ',' ? 1 : 0.94,
        });
        if (ch === '+' || ch === '/') {
          // Door slab across the opening.
          const horizontalWall = (map.tiles[y]?.[x - 1] === '#') || (map.tiles[y]?.[x + 1] === '#');
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.0, 0.12), std(pal.door));
          door.castShadow = true;
          const p = this.world(x, y);
          if (ch === '+') {
            door.position.set(p.x, 0.5, p.z);
            door.rotation.y = horizontalWall ? 0 : Math.PI / 2;
          } else {
            door.position.set(p.x + (horizontalWall ? -0.42 : 0), 0.5, p.z + (horizontalWall ? 0 : -0.42));
            door.rotation.y = horizontalWall ? Math.PI / 2 : 0;
          }
          door.userData = { x, y };
          this.wallsGroup.add(door);
        }
        if (ch === '>' || ch === '<') {
          for (let i = 0; i < 3; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.28), std(ch === '>' ? 0x2a2622 : 0x77716a));
            const p = this.world(x, y);
            step.position.set(p.x, ch === '>' ? 0.02 - i * 0.06 : 0.06 + i * 0.1, p.z - 0.3 + i * 0.3);
            step.receiveShadow = true;
            this.propsGroup.add(step);
          }
        }
      }
    }
    // Floor tiles.
    const floorGeo = new THREE.BoxGeometry(1, 0.2, 1);
    floorGeo.translate(0, -0.1, 0);
    const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });
    this.floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1, floors.length));
    this.floorMesh.receiveShadow = true;
    floors.forEach((f, i) => {
      const p = this.world(f.x, f.y);
      TMP.position.set(p.x, f.h, p.z);
      TMP.scale.set(f.gap, 1, f.gap);
      TMP.rotation.set(0, 0, 0);
      TMP.updateMatrix();
      this.floorMesh!.setMatrixAt(i, TMP.matrix);
      this.floorMesh!.setColorAt(i, f.color);
    });
    this.floorCells = floors.map((f) => ({ x: f.x, y: f.y, color: f.color }));
    this.mapGroup.add(this.floorMesh);
    // Walls: a unit box scaled by the walls group height.
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    wallGeo.translate(0, 0.5, 0);
    const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
    this.wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, walls.length));
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    walls.forEach((w, i) => {
      const p = this.world(w.x, w.y);
      TMP.position.set(p.x, 0, p.z);
      TMP.scale.set(1, 1, 1);
      TMP.updateMatrix();
      this.wallMesh!.setMatrixAt(i, TMP.matrix);
      this.wallMesh!.setColorAt(i, w.color);
    });
    this.wallCells = walls;
    this.wallsGroup.add(this.wallMesh);
    // Props.
    for (const p of map.props) {
      const model = propModel(p.kind, hash(p.x * 7, p.y * 13));
      const w = this.world(p.x, p.y);
      model.group.position.set(w.x, 0.02, w.z);
      model.group.rotation.y = -((p.rot ?? 0) * Math.PI) / 2;
      this.propsGroup.add(model.group);
      let lightObj: THREE.PointLight | undefined;
      if (model.light) {
        lightObj = new THREE.PointLight(model.light.color, 0, model.light.radius * 1.3, 1.5);
        lightObj.position.set(w.x, 1.0, w.z);
        this.scene.add(lightObj);
      }
      this.props.push({ x: p.x, y: p.y, model, lightObj });
    }
    const ambient = map.ambient;
    this.hemi.intensity = 0.35 + ambient * 0.75;
    this.sun.intensity = outdoor ? 1.6 : 0.25 + ambient * 0.8;
    this.renderer.toneMappingExposure = outdoor ? 1.0 : 1.1;
    for (const t of this.tokens.values()) this.tokenGroup.remove(t.group);
    this.tokens.clear();
    this.cutKey = '';
  }

  private fogAt(x: number, y: number): number {
    const f = this.data?.fog?.[y]?.[x];
    return f === '2' ? 1 : f === '1' ? 0.3 : f === undefined ? 1 : 0;
  }

  private applyFog() {
    if (!this.data) return;
    if (this.floorMesh) {
      this.floorCells.forEach((c, i) => {
        const f = this.fogAt(c.x, c.y);
        COLOR.copy(c.color).multiplyScalar(f);
        if (f < 1 && f > 0) COLOR.lerp(new THREE.Color(0x1a1d26), 0.25);
        this.floorMesh!.setColorAt(i, COLOR);
      });
      this.floorMesh.instanceColor!.needsUpdate = true;
    }
    if (this.wallMesh) {
      this.wallCells.forEach((c, i) => {
        // Walls take the brightest neighbor's visibility so room outlines read well.
        let f = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) f = Math.max(f, this.fogAt(c.x + dx, c.y + dy));
        COLOR.copy(c.color).multiplyScalar(f);
        this.wallMesh!.setColorAt(i, COLOR);
      });
      if (this.wallMesh.instanceColor) this.wallMesh.instanceColor.needsUpdate = true;
    }
    for (const p of this.props) {
      const f = this.fogAt(p.x, p.y);
      for (const m of p.model.mats) {
        m.mat.color.copy(m.base).multiplyScalar(f);
        if (m.emissive) m.mat.emissive.copy(m.emissive).multiplyScalar(f >= 1 ? 1 : 0.15);
      }
      if (p.lightObj) p.lightObj.userData.on = f >= 1 || this.data.map.ambient >= 0.5;
    }
    for (const child of this.wallsGroup.children) {
      if (child === this.wallMesh) continue;
      const { x, y } = child.userData as { x?: number; y?: number };
      if (x === undefined || y === undefined) continue;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (!child.userData.base) child.userData.base = mat.color.clone();
      mat.color.copy(child.userData.base as THREE.Color).multiplyScalar(this.fogAt(x, y));
    }
  }

  private syncTokens(first: boolean) {
    if (!this.data) return;
    const seen = new Set<string>();
    const targets = new Set(this.data.targetIds);
    for (const t of this.data.tokens) {
      seen.add(t.id);
      let obj = this.tokens.get(t.id);
      const key = `${t.name}|${t.color}|${t.kind}`;
      if (!obj || obj.key !== key) {
        if (obj) this.tokenGroup.remove(obj.group);
        obj = makeToken(t);
        obj.key = key;
        const p = this.world(t.x, t.y);
        obj.group.position.copy(p);
        this.tokens.set(t.id, obj);
        this.tokenGroup.add(obj.group);
      }
      obj.group.userData = { id: t.id };
      obj.to.copy(this.world(t.x, t.y));
      if (first) obj.group.position.copy(obj.to);
      obj.body.rotation.z = t.dead ? Math.PI / 2 : 0;
      obj.body.position.y = t.dead ? 0.15 : 0;
      obj.ring.visible = !t.dead;
      obj.label.visible = !t.dead || t.kind !== 'monster';
      const targeted = targets.has(t.id);
      obj.ringMat.emissive.set(targeted ? 0xff3322 : t.active ? 0xd6a84c : 0x000000);
      obj.ringMat.emissiveIntensity = targeted || t.active ? 1.2 : 0;
      obj.group.userData.pulse = targeted || t.active;
      if (t.kind === 'monster' && t.maxHp && !t.dead) {
        const hpKey = `${t.hp}/${t.maxHp}`;
        if (!obj.hp || obj.hp.userData.key !== hpKey) {
          if (obj.hp) obj.group.remove(obj.hp);
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTexture(t.hp ?? 0, t.maxHp), depthTest: false, transparent: true }));
          sprite.scale.set(0.9, 0.11, 1);
          sprite.position.y = 0.95;
          sprite.renderOrder = 11;
          sprite.userData.key = hpKey;
          obj.hp = sprite;
          obj.group.add(sprite);
        }
      } else if (obj.hp) {
        obj.group.remove(obj.hp);
        obj.hp = undefined;
      }
    }
    for (const [id, obj] of this.tokens) {
      if (!seen.has(id)) {
        this.tokenGroup.remove(obj.group);
        this.tokens.delete(id);
      }
    }
  }

  private syncHighlights() {
    if (!this.data) return;
    if (this.highlightMesh) {
      this.mapGroup.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
      this.highlightMesh = null;
    }
    const cells = this.data.moveTargets;
    if (!cells.length) return;
    const geo = new THREE.PlaneGeometry(0.86, 0.86);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4fb5a5, transparent: true, opacity: 0.32, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    cells.forEach((c, i) => {
      const p = this.world(c.x, c.y);
      TMP.position.set(p.x, 0.1, p.z);
      TMP.scale.set(1, 1, 1);
      TMP.rotation.set(0, 0, 0);
      TMP.updateMatrix();
      mesh.setMatrixAt(i, TMP.matrix);
    });
    mesh.renderOrder = 5;
    this.highlightMesh = mesh;
    this.mapGroup.add(mesh);
  }

  private focusPoint(): THREE.Vector3 | null {
    if (!this.data) return null;
    const id = this.data.focusId;
    const tok = (id && this.tokens.get(id)) || [...this.tokens.values()][0];
    return tok ? tok.to.clone() : this.world(this.data.map.spawn.x, this.data.map.spawn.y);
  }

  private snapToFocus() {
    const f = this.focusPoint();
    if (f) this.target.copy(this.framed(f));
    this.cutKey = '';
  }

  // -------------------------------------------------------------------------
  // Frame

  private frame() {
    if (this.disposed) return;
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    const time = this.timer.getElapsed();
    // Mode transition.
    this.modeT += (this.modeTarget - this.modeT) * Math.min(1, dt * 7);
    const t = this.modeT;
    this.wallsGroup.scale.y = THREE.MathUtils.lerp(WALL_H, 0.22, t);
    this.propsGroup.scale.y = THREE.MathUtils.lerp(1, 0.45, t);
    this.tokenGroup.scale.y = THREE.MathUtils.lerp(1, 0.6, t);
    // Follow focus unless the user panned recently; keep the map filling the view.
    const f = this.focusPoint();
    if (f && performance.now() - this.lastPan > 4000) this.target.lerp(this.framed(f), Math.min(1, dt * 3));
    this.updateCutaway(t);
    for (const obj of this.tokens.values()) {
      obj.label.position.set(0, THREE.MathUtils.lerp(1.15, 0.6, t), THREE.MathUtils.lerp(0, -0.62, t));
      if (obj.hp) obj.hp.position.set(0, THREE.MathUtils.lerp(0.95, 0.6, t), THREE.MathUtils.lerp(0, 0.55, t));
    }
    // Camera.
    const dist = 12.5 * this.zoom;
    const off3 = new THREE.Vector3(0, dist * 0.8, dist * 0.62);
    const off2 = new THREE.Vector3(0, dist * 1.12, 0.001);
    this.camera.position.copy(this.target).add(off3.lerp(off2, t));
    this.camera.lookAt(this.target);
    this.sun.target.position.copy(this.target);
    this.sun.position.copy(this.target).add(new THREE.Vector3(-8, 16, 10));
    // Tokens glide and pulse.
    for (const obj of this.tokens.values()) {
      obj.group.position.lerp(obj.to, Math.min(1, dt * 10));
      if (obj.group.userData.pulse) obj.ringMat.emissiveIntensity = 0.7 + Math.sin(time * 5) * 0.5;
    }
    // Lights flicker.
    const dark = (this.data?.map.ambient ?? 1) < 0.5;
    for (const p of this.props) {
      if (!p.lightObj) continue;
      const on = !!p.lightObj.userData.on;
      const flicker = 1 + Math.sin(time * 9 + p.x) * 0.08 + Math.sin(time * 23 + p.y) * 0.05;
      p.lightObj.intensity = on ? (t > 0.5 ? 0.6 : 1.4) * flicker * (dark ? 1.4 : 0.8) : 0;
    }
    const player = this.data?.tokens.find((x) => x.kind === 'player');
    const pobj = player ? this.tokens.get(player.id) : undefined;
    if (pobj && dark) {
      this.playerLight.position.copy(pobj.group.position).add(new THREE.Vector3(0, 1.4, 0));
      this.playerLight.intensity = (2.2 + Math.sin(time * 11) * 0.15) * (t > 0.5 ? 0.7 : 1);
    } else this.playerLight.intensity = 0;
    if (this.highlightMesh) (this.highlightMesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(time * 3) * 0.08;
    this.renderer.render(this.scene, this.camera);
  }

  /** Clamps a camera target so the visible area stays inside the map where possible. */
  private framed(p: THREE.Vector3): THREE.Vector3 {
    if (!this.data) return p;
    const m = this.data.map;
    const dist = 12.5 * this.zoom;
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * dist * 0.95;
    const halfW = halfH * this.camera.aspect;
    const out = p.clone();
    const clamp = (v: number, size: number, lo: number, hi: number) => (size / 2 - hi < -size / 2 + lo ? 0 : THREE.MathUtils.clamp(v, -size / 2 + lo, size / 2 - hi));
    out.x = clamp(p.x, m.width + 1, halfW, halfW);
    // A tilted camera sees more ground to the north (far) than to the south (near).
    const tilt = this.modeT;
    out.z = clamp(p.z, m.height + 1, halfH * THREE.MathUtils.lerp(1.35, 1, tilt), halfH * THREE.MathUtils.lerp(0.55, 1, tilt));
    return out;
  }

  /** In 3D, walls between the camera and the focus are lowered like a diorama cutaway. */
  private updateCutaway(t: number) {
    if (!this.wallMesh || !this.data) return;
    const f = this.focusPoint();
    if (!f) return;
    const key = `${Math.round(f.x)}:${Math.round(f.z)}:${t > 0.5 ? 1 : 0}`;
    if (key === this.cutKey) return;
    this.cutKey = key;
    this.wallCells.forEach((w, i) => {
      const p = this.world(w.x, w.y);
      const inFront = t <= 0.5 && p.z > f.z + 0.5 && p.z < f.z + 9 && Math.abs(p.x - f.x) < 9;
      TMP.position.set(p.x, 0, p.z);
      TMP.rotation.set(0, 0, 0);
      TMP.scale.set(1, inFront ? 0.22 : 1, 1);
      TMP.updateMatrix();
      this.wallMesh!.setMatrixAt(i, TMP.matrix);
    });
    this.wallMesh.instanceMatrix.needsUpdate = true;
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  // Input

  private bindInput(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.down) this.down.moved = true;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, cur);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.pinchDist > 0) this.setZoom(this.zoom * (this.pinchDist / d));
        this.pinchDist = d;
        return;
      }
      if (this.down && Math.hypot(cur.x - this.down.x, cur.y - this.down.y) > 7) this.down.moved = true;
      if (this.down?.moved) {
        const worldPerPx = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.distanceTo(this.target)) / Math.max(1, this.height);
        this.target.x -= (cur.x - prev.x) * worldPerPx;
        this.target.z -= ((cur.y - prev.y) * worldPerPx) / (this.modeT > 0.5 ? 1 : 0.78);
        this.clampTarget();
        this.lastPan = performance.now();
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.down && !this.down.moved && this.pointers.size === 0 && performance.now() - this.down.t < 450) this.tap(e.clientX, e.clientY);
      if (this.pointers.size === 0) this.down = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.down = null;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9));
      },
      { passive: false },
    );
  }

  private setZoom(z: number) {
    this.zoom = THREE.MathUtils.clamp(z, 0.45, 2.4);
  }

  private clampTarget() {
    if (!this.data) return;
    const m = this.data.map;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -m.width / 2, m.width / 2);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -m.height / 2, m.height / 2);
  }

  zoomBy(f: number) {
    this.setZoom(this.zoom * f);
  }

  /** Re-centers on the focused token (e.g. after the user panned away). */
  recenter() {
    this.lastPan = 0;
  }

  private tap(cx: number, cy: number) {
    if (!this.data) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.tokenGroup.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData?.id) o = o.parent;
      if (o?.userData?.id) {
        this.cb.onTokenTap(o.userData.id as string);
        return;
      }
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, p)) return;
    const m = this.data.map;
    const x = Math.floor(p.x + m.width / 2);
    const y = Math.floor(p.z + m.height / 2);
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
    // Tapping a tile with a token counts as tapping the token.
    const tok = this.data.tokens.find((t) => t.x === x && t.y === y);
    if (tok) this.cb.onTokenTap(tok.id);
    else this.cb.onTileTap(x, y);
  }
}

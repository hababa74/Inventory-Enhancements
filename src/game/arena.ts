import { type AABB } from "./math";

/**
 * Maps. Every map is axis-aligned so collision + raycasts stay cheap and exact.
 *
 * The arrays exported below are mutated in place by `setMap` so modules that
 * imported them (engine, renderer) keep working with the same references.
 */

export interface StaticBox {
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  kind: "ground" | "platform" | "cover" | "bounds" | "prop";
}

export interface MapTheme {
  /** flat ground checkerboard */
  groundA: string;
  groundB: string;
  groundLine: string;
  sky: string;
  fog: string;
  /** decorative neon strips + spawn rings */
  neon: boolean;
  /** optional tint for platforms / cover so nature maps don't look metallic */
  structure?: string;
}

/** Decorative-but-solid scenery (trees, cacti, rocks, dunes). */
export interface MapProp {
  kind: "palm" | "acacia" | "cactus" | "rock" | "dune" | "grass";
  x: number;
  z: number;
  s: number;
  rot: number;
}

export interface MapDef {
  id: string;
  name: string;
  tag: string;
  halfX: number;
  halfZ: number;
  wallHeight: number;
  boxes: StaticBox[];
  spawns: Array<{ x: number; y: number; z: number; yaw: number }>;
  theme: MapTheme;
  props?: MapProp[];
}

function b(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  kind: StaticBox["kind"],
): StaticBox {
  return { cx, cy, cz, sx, sy, sz, kind };
}

function stairs(x: number, z: number, dir: "north" | "south"): StaticBox[] {
  const out: StaticBox[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) / n) * 3;
    const zz = dir === "north" ? z - i * 0.9 : z + i * 0.9;
    out.push(b(x, h / 2, zz, 6, h, 0.9, "platform"));
  }
  return out;
}

function bounds(halfX: number, halfZ: number, wallHeight: number): StaticBox[] {
  return [
    b(0, wallHeight / 2, -halfZ - 1, halfX * 2 + 4, wallHeight, 2, "bounds"),
    b(0, wallHeight / 2, halfZ + 1, halfX * 2 + 4, wallHeight, 2, "bounds"),
    b(-halfX - 1, wallHeight / 2, 0, 2, wallHeight, halfZ * 2 + 4, "bounds"),
    b(halfX + 1, wallHeight / 2, 0, 2, wallHeight, halfZ * 2 + 4, "bounds"),
  ];
}

/** NEXUS PIT — compact, symmetric 1v1 training arena. */
const NEXUS: MapDef = (() => {
  const halfX = 26;
  const halfZ = 30;
  const wallHeight = 26;
  return {
    id: "nexus",
    name: "NEXUS PIT",
    tag: "Plattformen & Deckung",
    halfX,
    halfZ,
    wallHeight,
    boxes: [
      b(0, -1, 0, halfX * 2, 2, halfZ * 2, "ground"),
      b(-11, 1.5, 0, 9, 3, 9, "platform"),
      b(11, 1.5, 0, 9, 3, 9, "platform"),
      b(0, 2.5, 0, 7, 5, 7, "platform"),
      b(-6, 1, -18, 4, 2, 2.4, "cover"),
      b(6, 1, -18, 4, 2, 2.4, "cover"),
      b(-6, 1, 18, 4, 2, 2.4, "cover"),
      b(6, 1, 18, 4, 2, 2.4, "cover"),
      b(-20, 3, -9, 3, 6, 3, "cover"),
      b(20, 3, -9, 3, 6, 3, "cover"),
      b(-20, 3, 9, 3, 6, 3, "cover"),
      b(20, 3, 9, 3, 6, 3, "cover"),
      ...stairs(-11, -8.5, "north"),
      ...stairs(11, -8.5, "north"),
      ...stairs(-11, 8.5, "south"),
      ...stairs(11, 8.5, "south"),
      ...bounds(halfX, halfZ, wallHeight),
    ],
    spawns: [
      { x: 0, y: 0.1, z: -24, yaw: Math.PI },
      { x: 0, y: 0.1, z: 24, yaw: 0 },
    ],
    theme: {
      groundA: "#26303f",
      groundB: "#2c3648",
      groundLine: "#38475e",
      sky: "#080c14",
      fog: "#0d1420",
      neon: true,
    },
  };
})();

/** GRASS BOX — flat open field, nothing but grass. Pure build-fight map. */
const GRASSBOX: MapDef = (() => {
  const halfX = 55;
  const halfZ = 55;
  const wallHeight = 60;
  return {
    id: "grassbox",
    name: "GRASS BOX",
    tag: "Flaches Feld · nur Bauen",
    halfX,
    halfZ,
    wallHeight,
    boxes: [b(0, -1, 0, halfX * 2, 2, halfZ * 2, "ground"), ...bounds(halfX, halfZ, wallHeight)],
    spawns: [
      { x: 0, y: 0.1, z: -30, yaw: Math.PI },
      { x: 0, y: 0.1, z: 30, yaw: 0 },
    ],
    theme: {
      groundA: "#3f9a2f",
      groundB: "#4cb63a",
      groundLine: "#54c142",
      sky: "#131a52",
      fog: "#1b2470",
      neon: false,
    },
  };
})();

/** TRAINING YARD — solo practice: parkour, edit walls, target dummies, free build space. */
const TRAINING: MapDef = (() => {
  const halfX = 48;
  const halfZ = 48;
  const wallHeight = 50;
  const boxes: StaticBox[] = [b(0, -1, 0, halfX * 2, 2, halfZ * 2, "ground")];

  // jump/parkour ladder: platforms with growing gaps and heights
  for (let i = 0; i < 6; i++) {
    const h = 1.5 + i * 1.4;
    boxes.push(b(-30 + i * 6.5, h / 2, -30, 4.5, h, 4.5, "platform"));
  }

  // edit wall row: free-standing walls to practice editing and peeking
  for (let i = 0; i < 5; i++) boxes.push(b(-20 + i * 10, 2.5, 6, 6, 5, 0.8, "cover"));

  // target dummies (small pillars) spread across the far half
  const targets: Array<[number, number]> = [
    [12, -26],
    [20, -18],
    [28, -28],
    [16, -34],
    [30, -12],
  ];
  for (const [x, z] of targets) boxes.push(b(x, 1.1, z, 1.2, 2.2, 1.2, "cover"));

  // high-ground tower with ramps to fight down from
  boxes.push(b(0, 4, 26, 12, 8, 12, "platform"));
  boxes.push(...stairs(0, 18, "north"));

  boxes.push(...bounds(halfX, halfZ, wallHeight));

  return {
    id: "training",
    name: "TRAINING YARD",
    tag: "Solo · Parkour, Ziele & freies Bauen",
    halfX,
    halfZ,
    wallHeight,
    boxes,
    spawns: [
      { x: -34, y: 0.1, z: 34, yaw: Math.PI * 0.75 },
      { x: 34, y: 0.1, z: 34, yaw: -Math.PI * 0.75 },
    ],
    theme: {
      groundA: "#2f3a2c",
      groundB: "#38452f",
      groundLine: "#5c7a45",
      sky: "#0d1526",
      fog: "#16203a",
      neon: false,
    },
  };
})();


/** Deterministic RNG so visuals and colliders always match. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** DUST CANYON — huge open desert (3x the grass box) with trees, cacti, rocks and mesas. */
const DESERT: MapDef = (() => {
  const halfX = 165;
  const halfZ = 165;
  const wallHeight = 80;
  const boxes: StaticBox[] = [b(0, -1, 0, halfX * 2, 2, halfZ * 2, "ground")];
  const props: MapProp[] = [];
  const r = rng(20260904);

  // --- mesas: big climbable rock plateaus for high ground
  const mesas: Array<[number, number, number, number]> = [
    [-70, -60, 34, 9],
    [72, -74, 28, 12],
    [0, -110, 40, 7],
    [-96, 52, 30, 10],
    [86, 66, 36, 13],
    [-14, 96, 26, 8],
    [120, -8, 24, 11],
    [-130, -14, 22, 9],
  ];
  for (const [x, z, w, h] of mesas) {
    boxes.push(b(x, h / 2, z, w, h, w * 0.85, "platform"));
    // stepped ramp so players can run up without building
    const steps = Math.round(h / 1.1);
    for (let i = 0; i < steps; i++) {
      const sh = ((i + 1) / steps) * h;
      boxes.push(b(x, sh / 2, z + w * 0.42 + 1.4 + i * 1.6, w * 0.5, sh, 1.6, "platform"));
    }
  }

  // --- ruin walls: natural cover clusters
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * halfX * 1.7;
    const z = (r() - 0.5) * halfZ * 1.7;
    if (Math.hypot(x, z) < 22) continue;
    const long = 5 + r() * 9;
    const h = 2.4 + r() * 3.4;
    if (r() > 0.5) boxes.push(b(x, h / 2, z, long, h, 1, "cover"));
    else boxes.push(b(x, h / 2, z, 1, h, long, "cover"));
  }

  // --- scenery: trees, cacti, rocks, dunes (solid trunks / bodies)
  const place = (kind: MapProp["kind"], count: number, minS: number, maxS: number) => {
    for (let i = 0; i < count; i++) {
      const x = (r() - 0.5) * halfX * 1.9;
      const z = (r() - 0.5) * halfZ * 1.9;
      if (Math.hypot(x, z) < 16) continue;
      // keep scenery off the mesas
      if (mesas.some(([mx, mz, w]) => Math.abs(x - mx) < w * 0.8 && Math.abs(z - mz) < w * 0.8)) continue;
      const s = minS + r() * (maxS - minS);
      const prop: MapProp = { kind, x, z, s, rot: r() * Math.PI * 2 };
      props.push(prop);
      if (kind === "palm") boxes.push(b(x, 3.2 * s, z, 0.7 * s, 6.4 * s, 0.7 * s, "prop"));
      else if (kind === "acacia") boxes.push(b(x, 2.4 * s, z, 0.9 * s, 4.8 * s, 0.9 * s, "prop"));
      else if (kind === "cactus") boxes.push(b(x, 1.7 * s, z, 0.9 * s, 3.4 * s, 0.9 * s, "prop"));
      else if (kind === "rock") boxes.push(b(x, 0.7 * s, z, 2.4 * s, 1.4 * s, 2.4 * s, "prop"));
      else if (kind === "dune") boxes.push(b(x, 0.9 * s, z, 11 * s, 1.8 * s, 9 * s, "prop"));
    }
  };
  place("palm", 70, 0.85, 1.7);
  place("acacia", 46, 0.9, 1.6);
  place("cactus", 60, 0.8, 1.5);
  place("rock", 80, 0.7, 1.8);
  place("dune", 26, 0.8, 1.6);
  place("grass", 120, 0.7, 1.5);

  boxes.push(...bounds(halfX, halfZ, wallHeight));

  return {
    id: "desert",
    name: "DUST CANYON",
    tag: "XXL Wüste · Bäume, Kakteen & Mesas",
    halfX,
    halfZ,
    wallHeight,
    boxes,
    props,
    spawns: [
      { x: -40, y: 0.1, z: 120, yaw: Math.PI * 0.85 },
      { x: 40, y: 0.1, z: -120, yaw: -Math.PI * 0.15 },
      { x: 120, y: 0.1, z: 60, yaw: -Math.PI * 0.5 },
      { x: -120, y: 0.1, z: -60, yaw: Math.PI * 0.5 },
    ],
    theme: {
      groundA: "#c69b5f",
      groundB: "#d7ae72",
      groundLine: "#e0bb84",
      sky: "#e9b779",
      fog: "#ddb684",
      neon: false,
      structure: "#b0906a",
    },
  };
})();

export const MAPS: MapDef[] = [NEXUS, GRASSBOX, TRAINING, DESERT];

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? NEXUS;
}

/** Live map geometry — mutated in place by setMap. */
export const ARENA = { halfX: NEXUS.halfX, halfZ: NEXUS.halfZ, wallHeight: NEXUS.wallHeight };
export const STATIC_BOXES: StaticBox[] = [...NEXUS.boxes];
export const STATIC_COLLIDERS: AABB[] = [];
export const SPAWNS: Array<{ x: number; y: number; z: number; yaw: number }> = [...NEXUS.spawns];
export let currentMap: MapDef = NEXUS;

function rebuildColliders() {
  STATIC_COLLIDERS.length = 0;
  for (const s of STATIC_BOXES) {
    STATIC_COLLIDERS.push({
      minX: s.cx - s.sx / 2,
      maxX: s.cx + s.sx / 2,
      minY: s.cy - s.sy / 2,
      maxY: s.cy + s.sy / 2,
      minZ: s.cz - s.sz / 2,
      maxZ: s.cz + s.sz / 2,
    });
  }
}

export function setMap(id: string) {
  const m = getMap(id);
  currentMap = m;
  ARENA.halfX = m.halfX;
  ARENA.halfZ = m.halfZ;
  ARENA.wallHeight = m.wallHeight;
  STATIC_BOXES.length = 0;
  STATIC_BOXES.push(...m.boxes);
  SPAWNS.length = 0;
  SPAWNS.push(...m.spawns);
  rebuildColliders();
}

setMap(NEXUS.id);

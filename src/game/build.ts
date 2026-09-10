import { CELL, MATS, WALL_T, type BuildType, type MatId } from "./constants";
import { type AABB } from "./math";

export type Owner = "player" | "enemy";

export interface Piece {
  id: number;
  type: BuildType;
  /** grid coordinates: cell x, level y, cell z */
  gx: number;
  gy: number;
  gz: number;
  /** 0 = -Z, 1 = +X, 2 = +Z, 3 = -X */
  rot: number;
  owner: Owner;
  hp: number;
  maxHp: number;
  mat: MatId;
  /** 3x3 tile mask for wall/floor/roof; true = solid. Index r*3+c, r=0 is top row. */
  tiles: boolean[];
  colliders: AABB[];
  version: number;
}

let nextId = 1;
export function resetPieceIds() {
  nextId = 1;
}

/** Like createPiece but does NOT increment the global ID counter — for collision probes only. */
export function createPieceProbe(type: BuildType, gx: number, gy: number, gz: number, rot: number, owner: Owner): Piece {
  const p: Piece = {
    id: -1, // sentinel: probe pieces have no real ID
    type,
    gx,
    gy,
    gz,
    rot,
    owner,
    hp: 1,
    maxHp: 1,
    mat: "wood",
    tiles: fullTiles(),
    colliders: [],
    version: 0,
  };
  p.colliders = computeColliders(p);
  return p;
}

export function fullTiles(): boolean[] {
  return [true, true, true, true, true, true, true, true, true];
}

export function pieceKey(type: BuildType, gx: number, gy: number, gz: number, rot: number) {
  // Walls are edge-based: normalize so both cells share the same edge key.
  if (type === "wall") {
    let x = gx;
    let z = gz;
    let r = rot;
    if (rot === 2) {
      z += 1;
      r = 0;
    } else if (rot === 3) {
      x -= 1;
      r = 1;
    }
    return `wall:${x}:${gy}:${z}:${r}`;
  }
  if (type === "roof") return `floor:${gx}:${gy + 1}:${gz}`;
  return `${type}:${gx}:${gy}:${gz}`;
}

function box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB {
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Recomputes the collider list of a piece from its tile mask. */
export function computeColliders(p: Piece): AABB[] {
  const out: AABB[] = [];
  const t = CELL / 3;
  const x0 = p.gx * CELL;
  const z0 = p.gz * CELL;
  const y0 = p.gy * CELL;

  if (p.type === "wall") {
    const horizontal = p.rot === 0 || p.rot === 2;
    const edgeZ = p.rot === 0 ? z0 : z0 + CELL;
    const edgeX = p.rot === 3 ? x0 : x0 + CELL;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!p.tiles[r * 3 + c]) continue;
        const yA = y0 + (2 - r) * t;
        if (horizontal) {
          out.push(box(x0 + c * t, yA, edgeZ - WALL_T / 2, x0 + (c + 1) * t, yA + t, edgeZ + WALL_T / 2));
        } else {
          out.push(box(edgeX - WALL_T / 2, yA, z0 + c * t, edgeX + WALL_T / 2, yA + t, z0 + (c + 1) * t));
        }
      }
    }
    return out;
  }

  if (p.type === "floor" || p.type === "roof") {
    const y = p.type === "floor" ? y0 : y0 + CELL;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!p.tiles[r * 3 + c]) continue;
        out.push(box(x0 + c * t, y - WALL_T, z0 + r * t, x0 + (c + 1) * t, y, z0 + (r + 1) * t));
      }
    }
    return out;
  }

  // Stairs: Fortnite-style slim staircase — thin treads with open space underneath.
  const steps = 10;
  const d = CELL / steps;
  const rise = CELL / steps;
  const plankThickness = 0.06; // Sleek, thin Fortnite wooden planks
  const colWidth = CELL / 3;

  // Detect Fortnite stair edit shapes
  const isLeftHalf = (p.tiles[0] || p.tiles[3] || p.tiles[6]) && (!p.tiles[2] && !p.tiles[5] && !p.tiles[8]);
  const isRightHalf = (p.tiles[2] || p.tiles[5] || p.tiles[8]) && (!p.tiles[0] && !p.tiles[3] && !p.tiles[6]);
  const isReversed = !p.tiles[0] && !p.tiles[1] && !p.tiles[2] && (p.tiles[6] || p.tiles[7] || p.tiles[8]);

  for (let i = 0; i < steps; i++) {
    const stepIdx = isReversed ? steps - 1 - i : i;
    const top = y0 + (stepIdx + 1) * rise;
    const bottom = Math.max(y0, top - plankThickness);
    const r = Math.min(2, Math.floor((stepIdx / steps) * 3));

    // Active column range for this step
    let cMin = 0;
    let cMax = 3;
    if (isLeftHalf) {
      cMin = 0;
      cMax = 1.5; // Exactly 50% width, right side is open air
    } else if (isRightHalf) {
      cMin = 1.5; // Left side is open air, 50% width
      cMax = 3;
    } else {
      const hasC0 = p.tiles[r * 3 + 0];
      const hasC1 = p.tiles[r * 3 + 1];
      const hasC2 = p.tiles[r * 3 + 2];
      if (!hasC0 && !hasC1 && !hasC2) continue;
      if (hasC0 && !hasC1 && !hasC2) { cMin = 0; cMax = 1; }
      else if (!hasC0 && hasC1 && !hasC2) { cMin = 1; cMax = 2; }
      else if (!hasC0 && !hasC1 && hasC2) { cMin = 2; cMax = 3; }
      else if (hasC0 && hasC1 && !hasC2) { cMin = 0; cMax = 2; }
      else if (!hasC0 && hasC1 && hasC2) { cMin = 1; cMax = 3; }
      else { cMin = 0; cMax = 3; }
    }

    const startW = cMin * colWidth;
    const endW = cMax * colWidth;

    if (p.rot === 0) {
      // rises toward -Z
      const zHigh = z0 + CELL - (i + 1) * d;
      out.push(box(x0 + startW, bottom, zHigh, x0 + endW, top, zHigh + d));
    } else if (p.rot === 2) {
      // rises toward +Z
      const zHigh = z0 + (i + 1) * d;
      out.push(box(x0 + startW, bottom, zHigh - d, x0 + endW, top, zHigh));
    } else if (p.rot === 1) {
      // rises toward -X
      const xHigh = x0 + CELL - (i + 1) * d;
      out.push(box(xHigh, bottom, z0 + startW, xHigh + d, top, z0 + endW));
    } else {
      // rises toward +X
      const xHigh = x0 + (i + 1) * d;
      out.push(box(xHigh - d, bottom, z0 + startW, xHigh, top, z0 + endW));
    }
  }

  // Add 2 architectural support stringers underneath the active sides
  const beamThickness = 0.08;
  const leftEdge = isRightHalf ? 1.5 * colWidth : 0;
  const rightEdge = isLeftHalf ? 1.5 * colWidth : CELL;
  if (p.rot === 0 || p.rot === 2) {
    out.push(box(x0 + leftEdge, y0, z0, x0 + leftEdge + beamThickness, y0 + CELL * 0.45, z0 + CELL));
    out.push(box(x0 + rightEdge - beamThickness, y0, z0, x0 + rightEdge, y0 + CELL * 0.45, z0 + CELL));
  } else {
    out.push(box(x0, y0, z0 + leftEdge, x0 + CELL, y0 + CELL * 0.45, z0 + leftEdge + beamThickness));
    out.push(box(x0, y0, z0 + rightEdge - beamThickness, x0 + CELL, y0 + CELL * 0.45, z0 + rightEdge));
  }

  return out;
}

export interface TileQuad {
  pos: [number, number, number];
  rotY: number;
  rotX: number;
  size: number;
  normal: [number, number, number];
}

/** World-space quad for one 3x3 tile of a wall/floor/roof/ramp — used by the edit overlay. */
export function tileQuad(p: Piece, i: number): TileQuad | null {
  const t = CELL / 3;
  const x0 = p.gx * CELL;
  const z0 = p.gz * CELL;
  const y0 = p.gy * CELL;
  const r = Math.floor(i / 3);
  const c = i % 3;
  if (p.type === "wall") {
    const horizontal = p.rot === 0 || p.rot === 2;
    const edgeZ = p.rot === 0 ? z0 : z0 + CELL;
    const edgeX = p.rot === 3 ? x0 : x0 + CELL;
    const y = y0 + (2 - r) * t + t / 2;
    return horizontal
      ? { pos: [x0 + c * t + t / 2, y, edgeZ], rotY: 0, rotX: 0, size: t, normal: [0, 0, 1] }
      : { pos: [edgeX, y, z0 + c * t + t / 2], rotY: Math.PI / 2, rotX: 0, size: t, normal: [1, 0, 0] };
  }
  if (p.type === "floor" || p.type === "roof") {
    const y = p.type === "floor" ? y0 : y0 + CELL;
    return {
      pos: [x0 + c * t + t / 2, y, z0 + r * t + t / 2],
      rotY: 0,
      rotX: -Math.PI / 2,
      size: t,
      normal: [0, 1, 0],
    };
  }
  if (p.type === "ramp") {
    const colWidth = CELL / 3;
    const rowStep = CELL / 3;
    const yCenter = y0 + (2 - r + 0.5) * rowStep;
    if (p.rot === 0) {
      const zCenter = z0 + (r + 0.5) * rowStep;
      return {
        pos: [x0 + c * colWidth + colWidth / 2, yCenter, zCenter],
        rotX: -Math.PI / 4,
        rotY: 0,
        size: t,
        normal: [0, 0.7071, 0.7071],
      };
    } else if (p.rot === 2) {
      const zCenter = z0 + CELL - (r + 0.5) * rowStep;
      return {
        pos: [x0 + c * colWidth + colWidth / 2, yCenter, zCenter],
        rotX: Math.PI / 4,
        rotY: Math.PI,
        size: t,
        normal: [0, 0.7071, -0.7071],
      };
    } else if (p.rot === 1) {
      const xCenter = x0 + (r + 0.5) * rowStep;
      return {
        pos: [xCenter, yCenter, z0 + c * colWidth + colWidth / 2],
        rotX: 0,
        rotY: -Math.PI / 4,
        size: t,
        normal: [0.7071, 0.7071, 0],
      };
    } else {
      const xCenter = x0 + CELL - (r + 0.5) * rowStep;
      return {
        pos: [xCenter, yCenter, z0 + c * colWidth + colWidth / 2],
        rotX: 0,
        rotY: Math.PI / 4,
        size: t,
        normal: [-0.7071, 0.7071, 0],
      };
    }
  }
  return null;
}

export interface EditShapeInfo {
  name: string;
  icon: string;
  valid: boolean;
}

/** Analyzes the active 3x3 tiles to recognize standard Fortnite edit shapes. */
export function getEditShapeInfo(type: BuildType, tiles: boolean[]): EditShapeInfo {
  const count = tiles.filter(Boolean).length;
  if (count === 0) return { name: "UNGÜLTIG (LEER)", icon: "⚠️", valid: false };

  if (type === "wall") {
    if (count === 9) return { name: "VOLLE WAND", icon: "🧱", valid: true };

    // Doors: 2 vertical tiles cut out in bottom rows
    if (!tiles[4] && !tiles[7] && tiles[3] && tiles[5] && tiles[1]) {
      return { name: "TÜR (MITTE)", icon: "🚪", valid: true };
    }
    if (!tiles[3] && !tiles[6] && tiles[4] && tiles[7]) {
      return { name: "TÜR (LINKS)", icon: "🚪", valid: true };
    }
    if (!tiles[5] && !tiles[8] && tiles[4] && tiles[7]) {
      return { name: "TÜR (RECHTS)", icon: "🚪", valid: true };
    }

    // Windows
    if (!tiles[4] && tiles[7] && tiles[1] && tiles[3] && tiles[5]) {
      return { name: "FENSTER (MITTE)", icon: "🪟", valid: true };
    }
    if (!tiles[3] && tiles[4] && tiles[6]) {
      return { name: "FENSTER (LINKS)", icon: "🪟", valid: true };
    }
    if (!tiles[5] && tiles[4] && tiles[8]) {
      return { name: "FENSTER (RECHTS)", icon: "🪟", valid: true };
    }
    if (!tiles[3] && !tiles[5] && tiles[4]) {
      return { name: "DOPPEL-FENSTER", icon: "🪟", valid: true };
    }

    // Triangle / Corner edits
    if (!tiles[0] && !tiles[1] && !tiles[3] && (tiles[8] && (tiles[7] || tiles[5]))) {
      return { name: "DREIECK-WAND (RECHTS)", icon: "📐", valid: true };
    }
    if (!tiles[1] && !tiles[2] && !tiles[5] && (tiles[6] && (tiles[7] || tiles[3]))) {
      return { name: "DREIECK-WAND (LINKS)", icon: "📐", valid: true };
    }

    // Columns / Half Walls
    if (tiles[0] && tiles[3] && tiles[6] && !tiles[2] && !tiles[5] && !tiles[8]) {
      return { name: "HALBE WAND (LINKS)", icon: "🏛️", valid: true };
    }
    if (tiles[2] && tiles[5] && tiles[8] && !tiles[0] && !tiles[3] && !tiles[6]) {
      return { name: "HALBE WAND (RECHTS)", icon: "🏛️", valid: true };
    }
    if (tiles[1] && tiles[4] && tiles[7] && !tiles[0] && !tiles[2]) {
      return { name: "SÄULE (MITTE)", icon: "🏛️", valid: true };
    }

    // Low wall
    if (!tiles[0] && !tiles[1] && !tiles[2] && tiles[6] && tiles[7] && tiles[8]) {
      return !tiles[3] && !tiles[4] && !tiles[5]
        ? { name: "NIEDRIGE WAND", icon: "🧱", valid: true }
        : { name: "HALBHOHE WAND", icon: "🧱", valid: true };
    }

    // Archway
    if (!tiles[4] && !tiles[7] && (!tiles[6] || !tiles[8])) {
      return { name: "DURCHGANG (ARCH)", icon: "🕳️", valid: true };
    }

    // Unsupported floating wall
    if (!tiles[6] && !tiles[7] && !tiles[8]) {
      return { name: "UNGÜLTIG (SCHWEBEND)", icon: "⚠️", valid: false };
    }

    return { name: "WAND-EDIT", icon: "📐", valid: true };
  }

  if (type === "ramp") {
    if (count === 9) return { name: "VOLLE TREPPE", icon: "🪜", valid: true };

    const leftCol = tiles[0] && tiles[3] && tiles[6];
    const rightCol = tiles[2] && tiles[5] && tiles[8];
    const centerCol = tiles[1] && tiles[4] && tiles[7];

    if (leftCol && !rightCol) return { name: "HALBE TREPPE (LINKS)", icon: "🪜", valid: true };
    if (rightCol && !leftCol) return { name: "HALBE TREPPE (RECHTS)", icon: "🪜", valid: true };
    if (centerCol && !leftCol && !rightCol) return { name: "SCHMALE TREPPE", icon: "🪜", valid: true };

    if (!tiles[0] && !tiles[1] && !tiles[2] && (tiles[6] || tiles[7] || tiles[8])) {
      return { name: "UMGEKEHRTE TREPPE", icon: "🔄", valid: true };
    }

    return { name: "TREPPEN-EDIT", icon: "🪜", valid: true };
  }

  if (type === "floor" || type === "roof") {
    if (count === 9) return { name: type === "floor" ? "VOLLER BODEN" : "VOLLES DACH", icon: "🛡️", valid: true };
    if (count === 8) return { name: "BODEN-DURCHBRUCH (1 KACHEL)", icon: "🕳️", valid: true };
    if (count === 7 || count === 6) return { name: "DOUBLE-EDIT ÖFFNUNG", icon: "🕳️", valid: true };
    if (count <= 3) return { name: "ECK-PLATTFORM", icon: "📐", valid: true };
    if (type === "roof" && (count === 4 || count === 5)) return { name: "PYRAMIDEN-RAMPE", icon: "📐", valid: true };
    return { name: "BODEN-EDIT", icon: "🕳️", valid: true };
  }

  return { name: "BEARBEITEN", icon: "✏️", valid: true };
}

export function createPiece(
  type: BuildType,
  gx: number,
  gy: number,
  gz: number,
  rot: number,
  owner: Owner,
  mat: MatId = "wood",
): Piece {
  const p: Piece = {
    id: nextId++,
    type,
    gx,
    gy,
    gz,
    rot,
    owner,
    hp: MATS[mat].hp,
    maxHp: MATS[mat].hp,
    mat,
    tiles: fullTiles(),
    colliders: [],
    version: 0,
  };
  p.colliders = computeColliders(p);
  return p;
}

/** Bounding box of the whole piece (broadphase + edit targeting). */
export function pieceBounds(p: Piece): AABB {
  const x0 = p.gx * CELL;
  const z0 = p.gz * CELL;
  const y0 = p.gy * CELL;
  if (p.type === "wall") {
    const horizontal = p.rot === 0 || p.rot === 2;
    const edgeZ = p.rot === 0 ? z0 : z0 + CELL;
    const edgeX = p.rot === 3 ? x0 : x0 + CELL;
    return horizontal
      ? box(x0, y0, edgeZ - 0.3, x0 + CELL, y0 + CELL, edgeZ + 0.3)
      : box(edgeX - 0.3, y0, z0, edgeX + 0.3, y0 + CELL, z0 + CELL);
  }
  if (p.type === "floor") return box(x0, y0 - 0.4, z0, x0 + CELL, y0 + 0.1, z0 + CELL);
  if (p.type === "roof") return box(x0, y0 + CELL - 0.4, z0, x0 + CELL, y0 + CELL + 0.1, z0 + CELL);
  return box(x0, y0, z0, x0 + CELL, y0 + CELL, z0 + CELL);
}

/** Maps a world hit point on a wall/floor to a tile index (0..8), or -1. */
export function tileAtPoint(p: Piece, x: number, y: number, z: number): number {
  const t = CELL / 3;
  const x0 = p.gx * CELL;
  const z0 = p.gz * CELL;
  const y0 = p.gy * CELL;
  const cl = (v: number) => (v < 0 ? 0 : v > 2 ? 2 : v);
  if (p.type === "wall") {
    const horizontal = p.rot === 0 || p.rot === 2;
    const c = cl(Math.floor((horizontal ? x - x0 : z - z0) / t));
    const r = cl(2 - Math.floor((y - y0) / t));
    return r * 3 + c;
  }
  if (p.type === "floor" || p.type === "roof") {
    const c = cl(Math.floor((x - x0) / t));
    const r = cl(Math.floor((z - z0) / t));
    return r * 3 + c;
  }
  if (p.type === "ramp") {
    const r = cl(Math.floor((y - y0) / t));
    const horizontal = p.rot === 0 || p.rot === 2;
    const c = cl(Math.floor((horizontal ? x - x0 : z - z0) / t));
    return r * 3 + c;
  }
  return -1;
}

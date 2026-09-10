/**
 * Aim trainer for the TRAINING YARD map: floating target spheres, hit counter
 * and a fixed round timer. Purely local — no netcode, no damage model.
 */

export interface AimTarget {
  id: number;
  x: number;
  y: number;
  z: number;
  r: number;
  /** 0..1 pop-in animation */
  born: number;
}

export const AIM_ROUND_SECONDS = 60;
const TARGET_COUNT = 5;
const AREA = { minX: 6, maxX: 34, minZ: -38, maxZ: -6, minY: 1.2, maxY: 4.2 };

let nextId = 1;

export class AimTrainer {
  active = false;
  hits = 0;
  shots = 0;
  timeLeft = AIM_ROUND_SECONDS;
  best = 0;
  lastScore: { hits: number; shots: number } | null = null;
  targets: AimTarget[] = [];
  /** bumped whenever the target list changes so the renderer can rebuild */
  version = 0;

  private spawn(): AimTarget {
    return {
      id: nextId++,
      x: AREA.minX + Math.random() * (AREA.maxX - AREA.minX),
      y: AREA.minY + Math.random() * (AREA.maxY - AREA.minY),
      z: AREA.minZ + Math.random() * (AREA.maxZ - AREA.minZ),
      r: 0.42 + Math.random() * 0.16,
      born: 0,
    };
  }

  start() {
    this.active = true;
    this.hits = 0;
    this.shots = 0;
    this.timeLeft = AIM_ROUND_SECONDS;
    this.targets = Array.from({ length: TARGET_COUNT }, () => this.spawn());
    this.version++;
  }

  stop() {
    if (!this.active) return;
    this.lastScore = { hits: this.hits, shots: this.shots };
    if (this.hits > this.best) this.best = this.hits;
    this.active = false;
    this.targets = [];
    this.version++;
  }

  reset() {
    this.active = false;
    this.targets = [];
    this.hits = 0;
    this.shots = 0;
    this.timeLeft = AIM_ROUND_SECONDS;
    this.version++;
  }

  update(dt: number) {
    if (!this.active) return;
    this.timeLeft -= dt;
    for (const t of this.targets) t.born = Math.min(1, t.born + dt * 5);
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.stop();
    }
  }

  /** Registers one fired bullet (for accuracy). */
  countShot() {
    if (this.active) this.shots++;
  }

  /**
   * Ray/sphere test against live targets. Returns the hit distance when a
   * target is hit closer than `maxDist`, otherwise -1. A hit despawns the
   * target and spawns a fresh one.
   */
  rayHit(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
  ): { dist: number; x: number; y: number; z: number } | null {
    if (!this.active) return null;
    let bestT = maxDist;
    let bestI = -1;
    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i]!;
      const mx = t.x - ox;
      const my = t.y - oy;
      const mz = t.z - oz;
      const proj = mx * dx + my * dy + mz * dz;
      if (proj <= 0) continue;
      const d2 = mx * mx + my * my + mz * mz - proj * proj;
      const r2 = t.r * t.r;
      if (d2 > r2) continue;
      const hit = proj - Math.sqrt(r2 - d2);
      if (hit >= 0 && hit < bestT) {
        bestT = hit;
        bestI = i;
      }
    }
    if (bestI < 0) return null;
    const t = this.targets[bestI]!;
    const pos = { dist: bestT, x: ox + dx * bestT, y: oy + dy * bestT, z: oz + dz * bestT };
    this.hits++;
    this.targets[bestI] = this.spawn();
    this.version++;
    return pos;
  }
}

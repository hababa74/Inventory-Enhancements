import {
  BUILD_COOLDOWN,
  BUILD_ORDER,
  CELL,
  MATS,
  MAT_ORDER,
  MAT_COST,
  MAT_START,
  MAT_CAP,
  MAT_FARM,
  type MatId,
  MOVE,
  PLAYER_MAX_HP,
  PLAYER_MAX_SHIELD,
  WEAPONS,
  WEAPON_ORDER,
  LOADOUT_SLOTS,
  MELEE_WEAPON,
  type BuildType,
  type WeaponId,
  type GameMode,
  STORM_INITIAL_RADIUS,
  STORM_FINAL_RADIUS,
  STORM_SHRINK_DURATION,
  STORM_DAMAGE_PER_SEC,
  BOXFIGHT_SIZE,
  BOXFIGHT_HEIGHT,
} from "./constants";
import { SPAWNS, STATIC_COLLIDERS, setMap, currentMap } from "./arena";
import { AimTrainer } from "./aimTrainer";
import {
  computeColliders,
  createPiece,
  createPieceProbe,
  getEditShapeInfo,
  pieceBounds,
  pieceKey,
  resetPieceIds,
  tileAtPoint,
  type Owner,
  type Piece,
} from "./build";
import { clamp, damp, overlaps, rayAABB, type AABB } from "./math";
import { Sfx, setAudioListener, spatialSfx } from "./audio";
import { hudStore, settingsStore } from "./store";
import {
  recordKill,
  recordMatch,
  recordRoundWin,
  trackStat,
  type MatchSummary,
} from "./progression";

import { actionDown, actionPressed, endFrame, input, keyPressed } from "./input";

export interface Actor {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  hp: number;
  shield: number;
  grounded: boolean;
  crouching: boolean;
  height: number;
  alive: boolean;
  /** animation helpers */
  speed: number;
  animTime: number;
  shootAnim: number;
  reloadAnim: number;
  /** scope lens flare intensity (0..1) — visible when an enemy snipes */
  glint: number;
}

function makeActor(): Actor {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    hp: PLAYER_MAX_HP,
    shield: PLAYER_MAX_SHIELD,
    grounded: false,
    crouching: false,
    height: MOVE.height,
    alive: true,
    speed: 0,
    animTime: 0,
    shootAnim: 0,
    reloadAnim: 0,
    glint: 0,
  };
}

export interface Tracer {
  active: boolean;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  life: number;
  color: number;
}

export interface Rocket {
  active: boolean;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  life: number;
  fromPlayer: boolean;
}

export interface Arrow {
  active: boolean;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  life: number;
  stuckIn: string | null; // 'wood' if embedded in wall
  stuckPieceId: number | null; // ID of piece it's stuck in
  stuckTimer: number; // counts down 3s after sticking
  fromPlayer: boolean;
}

export interface SmokeParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number; // 0..0.8
  maxLife: number;
  scale: number;
}

export interface Impact {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
}

export interface BuildBreak {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  mat: MatId;
}

interface WeaponRuntime {
  ammo: number;
  reserve: number;
}

export interface GhostState {
  visible: boolean;
  valid: boolean;
  type: BuildType;
  gx: number;
  gy: number;
  gz: number;
  rot: number;
}

let feedId = 1;
let dmgId = 1;

export class Engine {
  /** aim-training subsystem (TRAINING YARD only) */
  aim = new AimTrainer();
  player = makeActor();
  bot = makeActor();
  pieces = new Map<string, Piece>();
  pieceList: Piece[] = [];
  buildVersion = 0;
  private buildListeners = new Set<() => void>();

  weapon: WeaponId = "rifle";
  prevWeapon: WeaponId = "shotgun";
  runtime: Record<WeaponId, WeaponRuntime> = {} as Record<WeaponId, WeaponRuntime>;
  buildMode = false;
  buildType: BuildType = "wall";
  buildRot = 0;
  editMode = false;
  editPiece: Piece | null = null;
  editSelection: boolean[] = new Array(9).fill(false);
  editAimTile = -1;
  private dragSelectTarget: boolean | null = null; // null = no drag, true = selecting, false = deselecting
  private editTilesCache: boolean[] = new Array(9).fill(true);
  /** Stable snapshot of the edited piece's tiles (avoids HUD churn). */
  private editPieceTilesSnapshot(): boolean[] {
    const t = this.editPiece?.tiles;
    if (!t) return this.editTilesCache;
    for (let i = 0; i < 9; i++) {
      if (this.editTilesCache[i] !== t[i]) {
        this.editTilesCache = t.slice();
        break;
      }
    }
    return this.editTilesCache;
  }
  ghost: GhostState = { visible: false, valid: false, type: "wall", gx: 0, gy: 0, gz: 0, rot: 0 };

  tracers: Tracer[] = [];
  impacts: Impact[] = [];
  private impactIdx = 0;
  buildBreaks: BuildBreak[] = [];
  private buildBreakIdx = 0;
  private impactIdx = 0;
  rockets: Rocket[] = [];
  arrows: Arrow[] = Array.from({ length: 8 }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: 0,
    dz: 0,
    speed: 0,
    life: 0,
    stuckIn: null,
    stuckPieceId: null,
    stuckTimer: 0,
    fromPlayer: true,
  }));
  smokeParticles: SmokeParticle[] = Array.from({ length: 60 }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    life: 0,
    maxLife: 0.8,
    scale: 0,
  }));
  /** weapons picked before the match (max LOADOUT_SLOTS) */
  loadout: WeaponId[] = ["rifle", "shotgun", "sniper", MELEE_WEAPON];
  recoilPitch = 0;
  recoilYaw = 0;
  shake = 0;
  bobTime = 0;
  /** camera-only view feel: landing dip, head bob and strafe lean */
  landDip = 0;
  viewLean = 0;
  /** power slide (sprint + crouch) */
  slideTime = 0;
  slideCd = 0;
  scoped = false;
  /** live camera position, published by the renderer (third person shooting) */
  camX = 0;
  camY = 0;
  camZ = 0;
  camActive = false;

  /** build materials, Fortnite style */
  mats: Record<MatId, number> = { wood: MAT_START, stone: MAT_START, metal: MAT_START };
  unlimitedMats = false;
  material: MatId = "wood";
  /** >0 while the player is looking with touch input (drives aim assist) */
  private touchLook = 0;

  scoreYou = 0;
  scoreEnemy = 0;
  roundTime = 0;
  countdown = -1;
  state: "idle" | "countdown" | "live" | "roundEnd" | "matchEnd" = "idle";
  /** elo/xp result of the last finished match */
  lastSummary: MatchSummary | null = null;

  // ---- kill-cam replay buffer ----------------------------------------------
  private replayBuffer: ReplayFrame[] = new Array(600).fill(null).map(() => ({
    t: 0,
    px: 0,
    py: 0,
    pz: 0,
    pyaw: 0,
    ppitch: 0,
    pHp: 100,
    pShield: 100,
    pAlive: true,
    bx: 0,
    by: 0,
    bz: 0,
    byaw: 0,
    bHp: 100,
    bShield: 100,
    weapon: "rifle",
  }));
  private replayIdx = 0;
  private replayCount = 0;
  private replayCapturing = false;

  private roundEndTimer = 0;
  private stamina = MOVE.staminaMax;
  private fireTimer = 0;
  private reloadTimer = 0;
  private switchTimer = 0;
  private buildTimer = 0;
  private lastPlacedCell = "";
  private pendingEditConfirm = false;
  private editEnteredAt = 0;
  private editTileChanged = false;
  private drinkTimer = 0; // counts up while LMB held on mini_shield
  drinkProgress = 0; // 0..1 for HUD progress bar

  private stepTimer = 0;
  private hudTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private killFeed: Array<{
    id: number;
    killer: string;
    victim: string;
    weapon: string;
    headshot: boolean;
    t: number;
  }> = [];
  private damageNumbers: Array<{
    id: number;
    amount: number;
    head: boolean;
    armor: boolean;
    dist: number;
    t: number;
  }> = [];
  private botTimers = { shoot: 0, think: 0, build: 0, jump: 0, strafe: 1 };
  private botTargetPitch = 0;
  /** bots #2..#5 for solo play — pooled so renderers keep stable references */
  extraBots: Array<{
    a: Actor;
    timers: { shoot: number; think: number; build: number; jump: number; strafe: number };
  }> = Array.from({ length: 4 }, () => ({
    a: makeActor(),
    timers: { shoot: 0, think: 0, build: 0, jump: 0, strafe: 1 },
  }));
  /** 0..5 bots in solo play (0 = empty training map) */
  botCount = 1;
  private nearby: AABB[] = [];
  botDifficulty = 1;
  /** 1 = very easy ... 5 = very hard */
  botLevel = 3;
  /** derived skill factors for the bot AI */
  private get skill() {
    const l = this.botLevel;
    return {
      spread: [2.2, 1.5, 1.0, 0.62, 0.34][l - 1]!,
      react: [0.55, 0.36, 0.22, 0.12, 0.05][l - 1]!,
      speed: [0.72, 0.82, 0.92, 1.0, 1.06][l - 1]!,
      build: [0.12, 0.28, 0.45, 0.7, 0.95][l - 1]!,
      turn: [3.0, 4.2, 6.0, 8.0, 10.0][l - 1]!,
    };
  }

  // ---- online play --------------------------------------------------------
  online = false;
  isHost = true;
  netSend: ((m: Record<string, unknown> & { t: string }) => void) | null = null;
  /** fired when the local player dies in an online match (match server hook) */
  onLocalDeath: (() => void) | null = null;
  private netTimer = 0;
  private remote: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vy: number;
    speed: number;
    grounded: boolean;
    height: number;
    hp: number;
    shield: number;
    alive: boolean;
    shoot: number;
  } | null = null;

  constructor() {
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      this.runtime[id] = { ammo: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    }
    for (let i = 0; i < 24; i++)
      this.tracers.push({
        active: false,
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 0,
        y2: 0,
        z2: 0,
        life: 0,
        color: 0x9ef7ff,
      });
    for (let i = 0; i < 24; i++) this.impacts.push({ active: false, x: 0, y: 0, z: 0, life: 0 });
    for (let i = 0; i < 20; i++)
      this.buildBreaks.push({ active: false, x: 0, y: 0, z: 0, life: 0, mat: "wood" });
    for (let i = 0; i < 8; i++)
      this.rockets.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        dx: 0,
        dy: 0,
        dz: 0,
        speed: 0,
        life: 0,
        fromPlayer: true,
      });
  }

  // ---- build subscription (React rendering) -------------------------------
  subscribeBuilds = (fn: () => void) => {
    this.buildListeners.add(fn);
    return () => {
      this.buildListeners.delete(fn);
    };
  };
  getBuildVersion = () => this.buildVersion;
  private bumpBuilds() {
    this.buildVersion++;
    this.buildListeners.forEach((l) => l());
  }

  // ---- match flow ---------------------------------------------------------
  /** Applies the chosen loadout; empty / partial picks are filled at random. */
  setLoadout(ids: WeaponId[]) {
    const picked = ids
      .filter((id, i) => WEAPONS[id] && ids.indexOf(id) === i)
      .slice(0, LOADOUT_SLOTS);
    const pool = WEAPON_ORDER.filter((id) => !picked.includes(id));
    while (picked.length < LOADOUT_SLOTS && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    }
    const full = [MELEE_WEAPON, ...picked];
    this.loadout = full;
    this.weapon = picked[0]!;
    this.prevWeapon = MELEE_WEAPON;
    hudStore.set({ loadout: full, weapon: this.weapon });
  }

  startMatch(bestOf: number, gameMode: GameMode = "duel") {
    this.gameMode = gameMode;
    const st = settingsStore.get();
    setMap(st.mapId);
    this.botLevel = Math.max(1, Math.min(5, Math.round(st.botLevel ?? 3)));
    const wanted = Math.max(0, Math.min(5, Math.round(st.botCount ?? 1)));
    // an empty match only makes sense on the training map
    this.botCount = this.online ? 1 : st.mapId === "training" ? wanted : Math.max(1, wanted);
    this.scoreYou = 0;
    this.scoreEnemy = 0;
    this.bestOf = bestOf;
    this.startRound();
    hudStore.set({ gameMode });
  }
  bestOf = 5;

  // ---- game mode & storm --------------------------------------------------
  gameMode: GameMode = "duel";
  stormRadius = STORM_INITIAL_RADIUS;
  stormCenterX = 0;
  stormCenterZ = 0;
  private stormTimer = 0;
  private stormDamageAccum = 0;

  startRound() {
    resetPieceIds();
    this.pieces.clear();
    this.pieceList = [];
    this.bumpBuilds();
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      this.runtime[id] = { ammo: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    }
    this.weapon = this.loadout[1] ?? this.loadout[0] ?? "rifle";
    this.prevWeapon = this.loadout[0] ?? this.weapon;
    for (const r of this.rockets) r.active = false;
    this.buildMode = false;
    this.editMode = false;
    this.editPiece = null;
    this.scoped = false;
    this.reloadTimer = 0;
    this.fireTimer = 0;

    const mine = this.online && !this.isHost ? 1 : 0;
    const a = SPAWNS[mine]!;
    const b = SPAWNS[1 - mine]!;
    Object.assign(this.player, makeActor(), { x: a.x, y: a.y, z: a.z, yaw: a.yaw });
    Object.assign(this.bot, makeActor(), { x: b.x, y: b.y, z: b.z, yaw: b.yaw });
    // extra solo bots ring around the enemy spawn; unused ones stay dead/hidden
    for (let i = 0; i < this.extraBots.length; i++) {
      const u = this.extraBots[i]!;
      const active = !this.online && this.botCount > i + 1;
      const ang = ((i + 1) / this.extraBots.length) * Math.PI * 2;
      Object.assign(u.a, makeActor(), {
        x: b.x + Math.cos(ang) * 4.5,
        y: b.y,
        z: b.z + Math.sin(ang) * 4.5,
        yaw: b.yaw,
      });
      u.a.alive = active;
      u.timers = { shoot: 0, think: 0, build: 0, jump: 0, strafe: Math.random() < 0.5 ? -1 : 1 };
    }
    if (!this.online && this.botCount === 0) {
      this.bot.alive = false;
      this.bot.hp = 0;
    }
    this.stamina = MOVE.staminaMax;
    this.unlimitedMats =
      this.gameMode === "boxfight" ||
      this.gameMode === "zonewars" ||
      settingsStore.get().unlimitedMats;
    this.mats = { wood: MAT_START, stone: MAT_START, metal: MAT_START };
    this.material = "wood";
    this.aim.reset();
    this.roundTime = 0;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.countdownStart = performance.now();
    this.liveStart = 0;
    this.lastCountdownTick = 4;
    this.state = "countdown";
    this.replayIdx = 0;
    this.replayCount = 0;
    this.replayCapturing = true;
    hudStore.set({ screen: "playing", roundResult: null, countdown: 3 });

    // Storm reset
    this.stormRadius = STORM_INITIAL_RADIUS;
    this.stormCenterX = 0;
    this.stormCenterZ = 0;
    this.stormTimer = 0;
    this.stormDamageAccum = 0;
    hudStore.set({
      stormRadius: STORM_INITIAL_RADIUS,
      stormActive: this.gameMode === "zonewars",
      inStorm: false,
    });

    // Box Fight: pre-place walls
    if (this.gameMode === "boxfight") {
      this.buildBoxFightArena();
    }
  }

  private buildBoxFightArena() {
    // Build a 3x3x3 box centered at grid (0,0)
    const S = BOXFIGHT_SIZE;
    const H = BOXFIGHT_HEIGHT;
    const cx = -Math.floor(S / 2);
    const cz = -Math.floor(S / 2);
    // Floors for each level
    for (let gy = 0; gy < H; gy++) {
      for (let gx = cx; gx < cx + S; gx++) {
        for (let gz = cz; gz < cz + S; gz++) {
          // Floor at bottom only
          if (gy === 0) {
            const p = createPiece("floor", gx, -1, gz, 0, "player", "wood");
            p.owner = "player"; // neutral
            const key = pieceKey("floor", gx, -1, gz, 0);
            this.pieces.set(key, p);
            this.pieceList.push(p);
          }
          // Ceiling
          if (gy === H - 1) {
            const p = createPiece("floor", gx, gy, gz, 0, "player", "wood");
            const key = pieceKey("floor", gx, gy, gz, 0);
            this.pieces.set(key, p);
            this.pieceList.push(p);
          }
          // Walls on edges
          if (gx === cx) {
            // West wall
            const p = createPiece("wall", gx, gy, gz, 3, "player", "wood");
            const key = pieceKey("wall", gx, gy, gz, 3);
            if (!this.pieces.has(key)) {
              this.pieces.set(key, p);
              this.pieceList.push(p);
            }
          }
          if (gx === cx + S - 1) {
            // East wall
            const p = createPiece("wall", gx, gy, gz, 1, "player", "wood");
            const key = pieceKey("wall", gx, gy, gz, 1);
            if (!this.pieces.has(key)) {
              this.pieces.set(key, p);
              this.pieceList.push(p);
            }
          }
          if (gz === cz) {
            // North wall
            const p = createPiece("wall", gx, gy, gz, 0, "player", "wood");
            const key = pieceKey("wall", gx, gy, gz, 0);
            if (!this.pieces.has(key)) {
              this.pieces.set(key, p);
              this.pieceList.push(p);
            }
          }
          if (gz === cz + S - 1) {
            // South wall
            const p = createPiece("wall", gx, gy, gz, 2, "player", "wood");
            const key = pieceKey("wall", gx, gy, gz, 2);
            if (!this.pieces.has(key)) {
              this.pieces.set(key, p);
              this.pieceList.push(p);
            }
          }
        }
      }
    }
    this.bumpBuilds();
  }

  private countdownTimer = 0;
  private countdownStart = 0;
  private liveStart = 0;
  private lastCountdownTick = 4;

  // ---- collision ----------------------------------------------------------
  private actorBox(a: Actor, x = a.x, y = a.y, z = a.z): AABB {
    const r = MOVE.radius;
    return { minX: x - r, maxX: x + r, minY: y, maxY: y + a.height, minZ: z - r, maxZ: z + r };
  }

  private gatherNearby(a: Actor) {
    const list = this.nearby;
    list.length = 0;
    const R = 7;
    for (const c of STATIC_COLLIDERS) {
      if (c.maxX < a.x - R || c.minX > a.x + R || c.maxZ < a.z - R || c.minZ > a.z + R) continue;
      if (c.maxY < a.y - 4 || c.minY > a.y + a.height + 4) continue;
      list.push(c);
    }
    for (const p of this.pieceList) {
      const b = pieceBounds(p);
      if (b.maxX < a.x - R || b.minX > a.x + R || b.maxZ < a.z - R || b.minZ > a.z + R) continue;
      for (const c of p.colliders) list.push(c);
    }
    return list;
  }

  /** Pushes an actor out of anything it is stuck inside (e.g. a fresh ramp). */
  private depenetrate(a: Actor, cols: AABB[]) {
    for (let pass = 0; pass < 4; pass++) {
      let worst: AABB | null = null;
      let worstDepth = 0;
      let box = this.actorBox(a);
      for (const c of cols) {
        if (!overlaps(box, c)) continue;
        const d = Math.min(
          box.maxX - c.minX,
          c.maxX - box.minX,
          box.maxY - c.minY,
          c.maxY - box.minY,
          box.maxZ - c.minZ,
          c.maxZ - box.minZ,
        );
        if (d > worstDepth) {
          worstDepth = d;
          worst = c;
        }
      }
      if (!worst) return;
      const c = worst;
      box = this.actorBox(a);
      const up = c.maxY - box.minY;
      if (up > 0 && up <= 1.6) {
        // stand on top of it — the normal fix for stepping into a ramp
        a.y = c.maxY + 0.002;
        if (a.vy < 0) a.vy = 0;
        a.grounded = true;
        continue;
      }
      const pushes: Array<[number, () => void]> = [
        [box.maxX - c.minX, () => (a.x = c.minX - MOVE.radius - 0.002)],
        [c.maxX - box.minX, () => (a.x = c.maxX + MOVE.radius + 0.002)],
        [box.maxZ - c.minZ, () => (a.z = c.minZ - MOVE.radius - 0.002)],
        [c.maxZ - box.minZ, () => (a.z = c.maxZ + MOVE.radius + 0.002)],
        [box.maxY - c.minY, () => (a.y = c.minY - a.height - 0.002)],
        [
          c.maxY - box.minY,
          () => {
            a.y = c.maxY + 0.002;
            if (a.vy < 0) a.vy = 0;
            a.grounded = true;
          },
        ],
      ];
      pushes.sort((p, q) => p[0] - q[0]);
      pushes[0]![1]();
    }
  }

  private moveActor(a: Actor, dt: number) {
    const cols = this.gatherNearby(a);
    this.depenetrate(a, cols);

    // --- vertical
    a.y += a.vy * dt;
    let box = this.actorBox(a);
    a.grounded = false;
    for (const c of cols) {
      if (!overlaps(box, c)) continue;
      if (a.vy <= 0 && box.minY < c.maxY && box.minY > c.maxY - 0.8 - Math.abs(a.vy * dt)) {
        a.y = c.maxY;
        a.vy = 0;
        a.grounded = true;
      } else if (a.vy > 0) {
        a.y = c.minY - a.height - 0.001;
        a.vy = 0;
      }
      box = this.actorBox(a);
    }
    if (a.y <= 0) {
      a.y = 0;
      if (a.vy < 0) a.vy = 0;
      a.grounded = true;
    }

    // --- horizontal, axis separated with step-up
    const wasGrounded = a.grounded;
    this.moveAxis(a, "x", a.vx * dt, cols);
    this.moveAxis(a, "z", a.vz * dt, cols);

    // If was grounded and walking down slopes/steps, snap down up to 0.28m to stick to ramp
    if (wasGrounded && a.vy <= 0 && !a.grounded) {
      const snapBox: AABB = {
        minX: a.x - MOVE.radius,
        maxX: a.x + MOVE.radius,
        minY: a.y - 0.28,
        maxY: a.y + 0.05,
        minZ: a.z - MOVE.radius,
        maxZ: a.z + MOVE.radius,
      };
      let bestSnapY = -Infinity;
      for (const c of cols) {
        if (overlaps(snapBox, c) && c.maxY <= a.y + 0.05 && c.maxY > bestSnapY) {
          bestSnapY = c.maxY;
        }
      }
      if (bestSnapY > -Infinity) {
        a.y = bestSnapY;
        a.vy = 0;
        a.grounded = true;
      }
    }
  }

  private moveAxis(a: Actor, axis: "x" | "z", amount: number, cols: AABB[]) {
    if (amount === 0) return;
    const before = a[axis];
    const beforeY = a.y;
    a[axis] = before + amount;
    let box = this.actorBox(a);
    for (const c of cols) {
      if (!overlaps(box, c)) continue;
      const step = c.maxY - a.y;
      if (step > 0.01 && step <= MOVE.stepHeight) {
        const testY = c.maxY + 0.002;
        const testBox = this.actorBox(a, a.x, testY, a.z);
        let free = true;
        for (const c2 of cols) {
          if (overlaps(testBox, c2)) {
            free = false;
            break;
          }
        }
        if (free) {
          a.y = testY;
          box = this.actorBox(a);
          continue;
        }
      }
      a[axis] = before;
      a.y = beforeY;
      if (axis === "x") a.vx = 0;
      else a.vz = 0;
      return;
    }
  }

  // ---- raycast ------------------------------------------------------------
  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    ignore: Actor | null,
    target: Actor | Actor[] | null,
  ): {
    dist: number;
    hit: "none" | "world" | "piece" | "actor";
    piece?: Piece;
    zone?: "head" | "body" | "legs";
    actor?: Actor;
  } {
    let best = maxDist;
    let result: {
      dist: number;
      hit: "none" | "world" | "piece" | "actor";
      piece?: Piece;
      zone?: "head" | "body" | "legs";
      actor?: Actor;
    } = { dist: maxDist, hit: "none" };
    const targetList = target ? (Array.isArray(target) ? target : [target]) : [];

    for (const c of STATIC_COLLIDERS) {
      const t = rayAABB(ox, oy, oz, dx, dy, dz, c, best);
      if (t >= 0 && t < best) {
        best = t;
        result = { dist: t, hit: "world" };
      }
    }
    for (const p of this.pieceList) {
      const bb = pieceBounds(p);
      if (rayAABB(ox, oy, oz, dx, dy, dz, bb, best) < 0) continue;
      for (const c of p.colliders) {
        const t = rayAABB(ox, oy, oz, dx, dy, dz, c, best);
        if (t >= 0 && t < best) {
          best = t;
          result = { dist: t, hit: "piece", piece: p };
        }
      }
    }
    for (const tgt of targetList) {
      if (!tgt.alive || tgt === ignore) continue;
      const r = MOVE.radius;
      const zones: Array<{ b: AABB; z: "head" | "body" | "legs" }> = [
        {
          b: {
            minX: tgt.x - 0.24,
            maxX: tgt.x + 0.24,
            minY: tgt.y + tgt.height - 0.42,
            maxY: tgt.y + tgt.height,
            minZ: tgt.z - 0.24,
            maxZ: tgt.z + 0.24,
          },
          z: "head",
        },
        {
          b: {
            minX: tgt.x - r,
            maxX: tgt.x + r,
            minY: tgt.y + tgt.height * 0.42,
            maxY: tgt.y + tgt.height - 0.42,
            minZ: tgt.z - r,
            maxZ: tgt.z + r,
          },
          z: "body",
        },
        {
          b: {
            minX: tgt.x - r,
            maxX: tgt.x + r,
            minY: tgt.y,
            maxY: tgt.y + tgt.height * 0.42,
            minZ: tgt.z - r,
            maxZ: tgt.z + r,
          },
          z: "legs",
        },
      ];
      for (const zn of zones) {
        const t = rayAABB(ox, oy, oz, dx, dy, dz, zn.b, best);
        if (t >= 0 && t < best) {
          best = t;
          result = { dist: t, hit: "actor", zone: zn.z, actor: tgt };
        }
      }
    }
    return result;
  }

  /** Starts/stops the target-dummy aim round (TRAINING YARD only). */
  toggleAimTrainer() {
    if (currentMap.id !== "training") return;
    if (this.aim.active) this.aim.stop();
    else this.aim.start();
  }

  /** every bot actor currently in play */
  botActors(): Actor[] {
    if (this.online) return [this.bot];
    const out: Actor[] = [];
    if (this.botCount > 0) out.push(this.bot);
    for (let i = 0; i < this.botCount - 1; i++) out.push(this.extraBots[i]!.a);
    return out;
  }

  private aliveBots(): Actor[] {
    return this.botActors().filter((b) => b.alive);
  }

  /** closest living bot to the player (for the HUD) */
  private nearestBot(): Actor | null {
    let best: Actor | null = null;
    let bd = Infinity;
    for (const b of this.aliveBots()) {
      const d = Math.hypot(b.x - this.player.x, b.z - this.player.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /** Camera-only vertical offset: landing dip + subtle head bob. */
  viewOffsetY(a: Actor) {
    const bob = Math.sin(this.bobTime * 2) * 0.022 * Math.min(1, a.speed / MOVE.walkSpeed);
    return bob - this.landDip;
  }

  eyeY(a: Actor) {
    return a.y + a.height - MOVE.eyeOffset;
  }

  // ---- damage -------------------------------------------------------------
  applyDamage(target: Actor, amount: number, head: boolean, fromPlayer: boolean, weapon: string) {
    if (!target.alive) return;
    let dmg = amount;
    let armor = false;
    const prevShield = target.shield;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
      armor = absorbed > 0;
    }
    target.hp -= dmg;
    if (fromPlayer) {
      const dist = Math.hypot(
        target.x - this.player.x,
        target.y - this.player.y,
        target.z - this.player.z,
      );
      const now = performance.now();
      this.damageNumbers = [
        ...this.damageNumbers.slice(-6),
        { id: dmgId++, amount: Math.round(amount), head, armor, dist, t: now },
      ];
      hudStore.set({
        lastHit: now,
        lastHeadshot: head ? now : hudStore.get().lastHeadshot,
        lastHitArmor: armor,
        lastHitDist: dist,
        lastHitDown: target.hp - dmg <= 0 ? now : hudStore.get().lastHitDown,
      });
      if (head) Sfx.headshot();
      else if (armor) Sfx.shieldHit();
      else Sfx.hit();
      if (prevShield > 0 && target.shield <= 0) Sfx.shieldBreak();
    } else {
      Sfx.hurt();
      if (prevShield > 0 && target.shield <= 0) Sfx.shieldBreak();
      this.shake = Math.min(1, this.shake + 0.35);
    }
    if (this.online && fromPlayer) {
      // the opponent is authoritative over its own health
      this.netSend?.({ t: "dmg", a: amount, h: head, w: weapon });
      if (target.hp <= 0) {
        // Locally deactivate the hitbox immediately for responsive feel;
        // the server will confirm and reconcile.
        target.hp = 0;
        target.alive = false;
      }
      return;
    }
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;

      if (target === this.player) {
        this.replayCapturing = false;
        // Snapshot replay buffer for kill-cam
        const frameCount = this.replayCount;
        if (frameCount > 0) {
          // Extract ordered frames from ring buffer
          const frames: ReplayFrame[] = [];
          const start = frameCount < 600 ? 0 : this.replayIdx;
          for (let i = 0; i < frameCount; i++) {
            frames.push({ ...this.replayBuffer[(start + i) % 600]! });
          }
          const duration = frameCount / 60; // approximate seconds
          hudStore.set({
            killCamActive: true,
            killCamFrames: frames,
            killCamDuration: duration,
          });
        }
      }
      if (!this.online && fromPlayer && this.aliveBots().length > 0) {
        // more bots left: count the frag, keep the round running
        this.killFeed = [
          ...this.killFeed.slice(-4),
          {
            id: feedId++,
            killer: "YOU",
            victim: hudStore.get().opponentName,
            weapon,
            headshot: head,
            t: performance.now(),
          },
        ];
        Sfx.kill();
        recordKill(head, weapon);
        return;
      }
      this.onKill(fromPlayer, head, weapon);
      if (this.online && !fromPlayer) {
        this.netSend?.({ t: "died" });
        this.onLocalDeath?.();
      }
    }
  }

  private onKill(byPlayer: boolean, head: boolean, weapon: string) {
    const killer = byPlayer ? "YOU" : hudStore.get().opponentName;
    const victim = byPlayer ? hudStore.get().opponentName : "YOU";
    this.killFeed = [
      ...this.killFeed.slice(-4),
      { id: feedId++, killer, victim, weapon, headshot: head, t: performance.now() },
    ];
    if (byPlayer) {
      this.scoreYou++;
      Sfx.kill();
      recordKill(head, weapon);
      recordRoundWin();
    } else {
      this.scoreEnemy++;
      Sfx.defeat();
    }
    this.state = "roundEnd";
    this.roundEndTimer = 0;
    const need = Math.ceil(this.bestOf / 2);
    const matchOver = this.scoreYou >= need || this.scoreEnemy >= need;
    hudStore.set({
      screen: matchOver ? "matchEnd" : "roundEnd",
      roundResult: byPlayer ? "win" : "loss",
      matchResult: matchOver ? (this.scoreYou >= need ? "win" : "loss") : null,
      aimTrainer: {
        available: currentMap.id === "training",
        active: this.aim.active,
        hits: this.aim.hits,
        shots: this.aim.shots,
        timeLeft: Math.max(0, this.aim.timeLeft),
        best: this.aim.best,
        lastHits: this.aim.lastScore?.hits ?? null,
        lastShots: this.aim.lastScore?.shots ?? null,
      },
      scoreYou: this.scoreYou,
      scoreEnemy: this.scoreEnemy,
    });
    if (matchOver) {
      this.state = "matchEnd";
      const won = this.scoreYou >= need;
      this.lastSummary = recordMatch(won, undefined, this.online);
      if (won) Sfx.victory();
    }
  }

  // ---- building -----------------------------------------------------------
  private forward(a: Actor, out: { x: number; y: number; z: number }) {
    const cp = Math.cos(a.pitch);
    out.x = -Math.sin(a.yaw) * cp;
    out.y = Math.sin(a.pitch);
    out.z = -Math.cos(a.yaw) * cp;
  }
  private fwd = { x: 0, y: 0, z: 0 };

  private dominantDir(a: Actor) {
    const fx = -Math.sin(a.yaw);
    const fz = -Math.cos(a.yaw);
    if (Math.abs(fz) >= Math.abs(fx)) return fz < 0 ? 0 : 2;
    return fx > 0 ? 1 : 3;
  }

  /** manual rotation applied on top of the look direction (R key) */
  rotOffset = 0;
  private lastDominant = -1;

  private computeGhost(a: Actor, type: BuildType) {
    const dom = this.dominantDir(a);
    if (dom !== this.lastDominant) {
      this.lastDominant = dom;
      // Note: rotOffset is intentionally NOT reset here so that manually
      // rotated pieces keep their orientation when the player looks around.
    }
    const dir = (dom + this.rotOffset + 4) % 4;
    const gy = Math.floor((a.y + 0.2) / CELL);
    const cx = Math.floor(a.x / CELL);
    const cz = Math.floor(a.z / CELL);
    if (type === "floor") {
      // floor snaps into the cell you are looking at
      const ox = dir === 1 ? 1 : dir === 3 ? -1 : 0;
      const oz = dir === 2 ? 1 : dir === 0 ? -1 : 0;
      return { gx: cx + ox, gy, gz: cz + oz, rot: dir };
    }
    // wall snaps to the edge of your own cell, ramp/roof fill your own cell
    return { gx: cx, gy, gz: cz, rot: dir };
  }

  private ghostValid(
    type: BuildType,
    gx: number,
    gy: number,
    gz: number,
    rot: number,
    owner: Owner,
  ) {
    if (gy < 0 || gy > 6) return false;
    const key = pieceKey(type, gx, gy, gz, rot);
    const existing = this.pieces.get(key);
    // Own pieces block, enemy pieces can be replaced by building through them.
    if (existing && existing.owner === owner) return false;
    const probe = createPieceProbe(type, gx, gy, gz, rot, owner);
    // ramps and roofs may enclose their builder (you get pushed up / stand under it)
    const skipSelf = type === "ramp" || type === "roof";
    const actors = [this.player, ...this.botActors()];
    for (const act of actors) {
      if (!act.alive) continue;
      const isOwner =
        (owner === "player" && act === this.player) || (owner === "enemy" && act !== this.player);
      if (skipSelf && isOwner) continue;
      const box = this.actorBox(act);
      for (const c of probe.colliders) {
        if (overlaps(box, c)) return false;
      }
    }
    return true;
  }

  placeBuild(owner: Owner, actor: Actor, type: BuildType) {
    const g = this.computeGhost(actor, type);
    if (!this.ghostValid(type, g.gx, g.gy, g.gz, g.rot, owner)) return false;
    const mat: MatId = owner === "player" ? this.material : "wood";
    if (owner === "player" && !this.unlimitedMats && this.mats[mat] < MAT_COST) return false;
    const key = pieceKey(type, g.gx, g.gy, g.gz, g.rot);
    const existing = this.pieces.get(key);
    if (existing) {
      // If an enemy placed here in the same tick: 50/50 coin flip
      if (existing.owner !== owner && Math.random() < 0.5) return false;
      this.removePiece(existing);
    }
    const piece = createPiece(type, g.gx, g.gy, g.gz, g.rot, owner, mat);
    if (owner === "player" && !this.unlimitedMats) {
      this.mats[mat] = Math.max(0, this.mats[mat] - MAT_COST);
    }
    this.pieces.set(key, piece);
    this.pieceList.push(piece);
    this.bumpBuilds();
    if (owner === "player") trackStat("builds");
    if (owner === "enemy") {
      spatialSfx(() => Sfx.build(), g.gx * CELL, g.gy * CELL, g.gz * CELL);
    } else {
      Sfx.build();
    }

    if (this.online && owner === "player") {
      this.netSend?.({ t: "b", bt: type, gx: g.gx, gy: g.gy, gz: g.gz, r: g.rot, mt: mat });
    }
    return true;
  }

  /** pickaxe harvesting */
  farmMat(mat: MatId) {
    this.mats[mat] = Math.min(MAT_CAP, this.mats[mat] + MAT_FARM);
  }

  setMaterial(mat: MatId) {
    this.material = mat;
  }

  cycleMaterial(dir = 1) {
    const i = MAT_ORDER.indexOf(this.material);
    const next = MAT_ORDER[(i + dir + MAT_ORDER.length) % MAT_ORDER.length]!;
    this.material = next;
  }

  damagePiece(p: Piece, amount: number) {
    p.hp -= amount;
    p.version++;
    if (p.hp <= 0) this.removePiece(p);
    else this.bumpBuilds();
  }

  removePiece(p: Piece, fromNet = false) {
    const key = pieceKey(p.type, p.gx, p.gy, p.gz, p.rot);
    if (this.online && !fromNet) this.netSend?.({ t: "rm", k: key });
    this.pieces.delete(key);
    const i = this.pieceList.indexOf(p);
    if (i >= 0) this.pieceList.splice(i, 1);
    this.spawnBuildBreak(p);
    if (this.editPiece === p) this.exitEdit(false);
    Sfx.breakBuild();
    this.bumpBuilds();
  }

  // ---- edit ---------------------------------------------------------------
  tryEnterEdit() {
    const a = this.player;
    this.forward(a, this.fwd);
    const ox = this.camActive ? this.camX : a.x;
    const oy = this.camActive ? this.camY : this.eyeY(a);
    const oz = this.camActive ? this.camZ : a.z;
    const reach = 14;
    const hit = this.raycast(ox, oy, oz, this.fwd.x, this.fwd.y, this.fwd.z, reach, a, null);
    let targetPiece = hit.hit === "piece" && hit.piece?.owner === "player" ? hit.piece : null;
    if (!targetPiece) {
      // Test broadphase bounds so player-owned pieces with cutouts (doors, windows) can still be selected
      let bestDist = reach;
      for (const p of this.pieceList) {
        if (p.owner !== "player") continue;
        const b = pieceBounds(p);
        const t = rayAABB(ox, oy, oz, this.fwd.x, this.fwd.y, this.fwd.z, b, reach);
        if (t > 0 && t < bestDist) {
          bestDist = t;
          targetPiece = p;
        }
      }
    }
    if (!targetPiece) return false;
    this.editPiece = targetPiece;
    this.editMode = true;
    // Copy the piece's current tiles directly as the editing canvas
    this.editSelection = targetPiece.tiles.slice();
    this.editAimTile = -1;
    this.dragSelectTarget = null;
    this.pendingEditConfirm = false;
    this.editTileChanged = false;
    this.editEnteredAt = performance.now();
    this.buildMode = false;
    this.scoped = false;
    Sfx.edit();
    this.bumpBuilds(); // Immediately transforms the 3D piece to glowing blueprint!
    return true;
  }

  updateEditAim() {
    const p = this.editPiece;
    if (!p) return -1;
    const a = this.player;
    this.forward(a, this.fwd);

    const ox = this.camActive ? this.camX : a.x;
    const oy = this.camActive ? this.camY : this.eyeY(a);
    const oz = this.camActive ? this.camZ : a.z;
    const dx = this.fwd.x;
    const dy = this.fwd.y;
    const dz = this.fwd.z;

    let bestDist = 14;
    let bestTile = -1;

    // Test ray against each tile quad's actual world geometry
    for (let i = 0; i < 9; i++) {
      const q = tileQuad(p, i);
      if (!q) continue;

      const [px, py, pz] = q.pos;
      const [nx, ny, nz] = q.normal;

      const denom = dx * nx + dy * ny + dz * nz;
      if (Math.abs(denom) < 1e-4) continue;

      const dist = ((px - ox) * nx + (py - oy) * ny + (pz - oz) * nz) / denom;
      if (dist <= 0 || dist >= bestDist) continue;

      const hx = ox + dx * dist;
      const hy = oy + dy * dist;
      const hz = oz + dz * dist;

      const diffX = hx - px;
      const diffY = hy - py;
      const diffZ = hz - pz;
      const half = q.size * 0.58; // generous tolerance for smooth mouse dragging

      let inside = false;
      if (p.type === "wall") {
        const horizontal = p.rot === 0 || p.rot === 2;
        const u = horizontal ? Math.abs(diffX) : Math.abs(diffZ);
        const v = Math.abs(diffY);
        inside = u <= half && v <= half;
      } else if (p.type === "floor" || p.type === "roof") {
        inside = Math.abs(diffX) <= half && Math.abs(diffZ) <= half;
      } else if (p.type === "ramp") {
        if (p.rot === 0 || p.rot === 2) {
          const slopeDist = Math.hypot(diffY, diffZ);
          inside = Math.abs(diffX) <= half && slopeDist <= half * 1.45;
        } else {
          const slopeDist = Math.hypot(diffY, diffX);
          inside = Math.abs(diffZ) <= half && slopeDist <= half * 1.45;
        }
      }

      if (inside) {
        bestDist = dist;
        bestTile = i;
      }
    }

    if (bestTile >= 0) return bestTile;

    // Fallback: AABB broadphase if ray barely missed quad boundaries
    const bb = pieceBounds(p);
    const t = rayAABB(ox, oy, oz, dx, dy, dz, bb, 12);
    if (t < 0) return -1;
    return tileAtPoint(p, ox + dx * t, oy + dy * t, oz + dz * t);
  }

  setEditTile(i: number, solid: boolean) {
    if (!this.editMode || i < 0 || i > 8) return;
    if (this.editSelection[i] === solid) return;
    const sel = this.editSelection.slice();
    sel[i] = solid;
    this.editSelection = sel;
    this.editTileChanged = true;
    Sfx.edit();
    this.bumpBuilds();
  }

  toggleEditTile(i: number) {
    if (!this.editMode || i < 0 || i > 8) return;
    const sel = this.editSelection.slice();
    sel[i] = !sel[i];
    this.editSelection = sel;
    this.editTileChanged = true;
    Sfx.edit();
    this.bumpBuilds();
  }

  confirmEdit() {
    if (this.editMode) this.exitEdit(true);
  }
  cancelEdit() {
    if (this.editMode) this.exitEdit(false);
  }

  exitEdit(apply: boolean) {
    const p = this.editPiece;
    if (p && apply) {
      // Validate that the shape is valid (no floating/disconnected fragments)
      const shape = getEditShapeInfo(p.type, this.editSelection);
      if (!shape.valid && !this.editSelection.every((t) => !t)) {
        this.resetEditedPiece();
        this.editMode = false;
        this.editPiece = null;
        this.editSelection = [true, true, true, true, true, true, true, true, true];
        this.dragSelectTarget = null;
        this.pendingEditConfirm = false;
        this.editTileChanged = false;
        this.bumpBuilds();
        return;
      }
      let changed = false;
      for (let i = 0; i < 9; i++) {
        if (p.tiles[i] !== this.editSelection[i]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        // never leave a fully removed piece floating as an invisible ghost
        if (this.editSelection.every((t) => !t)) {
          this.removePiece(p);
          this.editMode = false;
          this.editPiece = null;
          this.editSelection = [true, true, true, true, true, true, true, true, true];
          this.dragSelectTarget = null;
          this.pendingEditConfirm = false;
          this.editTileChanged = false;
          this.bumpBuilds();
          return;
        }
        p.tiles = this.editSelection.slice();
        p.colliders = computeColliders(p);
        p.version++;
        Sfx.edit();
        trackStat("edits");

        if (this.online) {
          this.netSend?.({
            t: "e",
            k: pieceKey(p.type, p.gx, p.gy, p.gz, p.rot),
            tiles: p.tiles.slice(),
          });
        }
      }
    }
    this.editMode = false;
    this.editPiece = null;
    this.editSelection = [true, true, true, true, true, true, true, true, true];
    this.dragSelectTarget = null;
    this.pendingEditConfirm = false;
    this.editTileChanged = false;
    this.bumpBuilds(); // Restores original material for the mesh
  }

  resetEditedPiece() {
    const p = this.editPiece;
    if (!p) return;
    this.editSelection = [true, true, true, true, true, true, true, true, true];
    Sfx.edit();
    this.bumpBuilds();
  }

  // ---- shooting -----------------------------------------------------------
  private spawnTracer(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    color: number,
  ) {
    const t =
      this.tracers.find((tr) => !tr.active) ??
      (() => {
        const idx = this.tracerIdx++ % this.tracers.length;
        return this.tracers[idx]!;
      })();
    t.active = true;
    t.x1 = x1;
    t.y1 = y1;
    t.z1 = z1;
    t.x2 = x2;
    t.y2 = y2;
    t.z2 = z2;
    t.life = 0.07;
    t.color = color;
  }
  private spawnImpact(x: number, y: number, z: number) {
    const i =
      this.impacts.find((im) => !im.active) ??
      (() => {
        const idx = this.impactIdx++ % this.impacts.length;
        return this.impacts[idx]!;
      })();
    i.active = true;
    i.x = x;
    i.y = y;
    i.z = z;
    i.life = 0.35;
  }

  private spawnBuildBreak(p: Piece) {
    const b = pieceBounds(p);
    const fx =
      this.buildBreaks.find((item) => !item.active) ??
      this.buildBreaks[this.buildBreakIdx++ % this.buildBreaks.length]!;
    fx.active = true;
    fx.x = (b.minX + b.maxX) / 2;
    fx.y = (b.minY + b.maxY) / 2;
    fx.z = (b.minZ + b.maxZ) / 2;
    fx.life = 0.75;
    fx.mat = p.mat;
  }

  private spawnRocket(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    speed: number,
    fromPlayer: boolean,
  ) {
    const r = this.rockets.find((rk) => !rk.active) ?? this.rockets[0]!;
    r.active = true;
    r.x = x;
    r.y = y;
    r.z = z;
    r.dx = dx;
    r.dy = dy;
    r.dz = dz;
    r.speed = speed;
    r.life = 5;
    r.fromPlayer = fromPlayer;
  }

  private spawnArrow(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    speed: number,
    fromPlayer: boolean,
  ) {
    const a = this.arrows.find((ar) => !ar.active) ?? this.arrows[0]!;
    a.active = true;
    a.x = x;
    a.y = y;
    a.z = z;
    a.dx = dx;
    a.dy = dy;
    a.dz = dz;
    a.speed = speed;
    a.life = 8;
    a.stuckIn = null;
    a.stuckPieceId = null;
    a.stuckTimer = 0;
    a.fromPlayer = fromPlayer;
  }

  private spawnSmoke(x: number, y: number, z: number) {
    const s = this.smokeParticles.find((p) => !p.active) ?? this.smokeParticles[0]!;
    s.active = true;
    s.x = x + (Math.random() - 0.5) * 0.15;
    s.y = y + (Math.random() - 0.5) * 0.1;
    s.z = z + (Math.random() - 0.5) * 0.15;
    s.life = 0;
    s.maxLife = 0.6 + Math.random() * 0.4;
    s.scale = 0.1;
  }

  private updateRockets(dt: number) {
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const step = r.speed * dt;
      const shooter = r.fromPlayer ? this.player : this.bot;
      const target: Actor | Actor[] = r.fromPlayer ? this.botActors() : this.player;
      const hit = this.raycast(r.x, r.y, r.z, r.dx, r.dy, r.dz, step, shooter, target);
      if (hit.hit !== "none") {
        const d = Math.max(0, hit.dist - 0.05);
        this.explode(r.x + r.dx * d, r.y + r.dy * d, r.z + r.dz * d, r.fromPlayer);
        r.active = false;
        continue;
      }
      // emit smoke trail
      if (Math.random() < 0.7) this.spawnSmoke(r.x, r.y, r.z);
      r.x += r.dx * step;
      r.y += r.dy * step;
      r.z += r.dz * step;
      // slight gravity drop for feel
      r.dy -= 1.4 * dt * 0.06;
      const len = Math.hypot(r.dx, r.dy, r.dz) || 1;
      r.dx /= len;
      r.dy /= len;
      r.dz /= len;
    }
  }

  private updateArrows(dt: number) {
    for (const ar of this.arrows) {
      if (!ar.active) continue;
      if (ar.stuckIn) {
        // If piece was destroyed or removed, drop the arrow immediately
        if (ar.stuckPieceId !== null) {
          const piece = this.pieceList.find((p) => p.id === ar.stuckPieceId);
          if (!piece || piece.hp <= 0) {
            ar.active = false;
            continue;
          }
        }
        ar.stuckTimer -= dt;
        if (ar.stuckTimer <= 0) ar.active = false;
        continue;
      }
      ar.life -= dt;
      if (ar.life <= 0) {
        ar.active = false;
        continue;
      }
      // gravity arc
      ar.dy -= 9.8 * dt * 0.12;
      const len = Math.hypot(ar.dx, ar.dy, ar.dz) || 1;
      ar.dx /= len;
      ar.dy /= len;
      ar.dz /= len;
      const step = ar.speed * dt;
      const shooter = ar.fromPlayer ? this.player : this.bot;
      const target: Actor | Actor[] = ar.fromPlayer ? this.botActors() : this.player;
      const hit = this.raycast(ar.x, ar.y, ar.z, ar.dx, ar.dy, ar.dz, step, shooter, target);
      if (hit.hit !== "none") {
        if (hit.hit === "actor" && hit.actor) {
          const w = WEAPONS["bow"];
          const mult = hit.zone === "head" ? w.headMult : hit.zone === "legs" ? w.legMult : 1;
          this.applyDamage(hit.actor, w.damage * mult, hit.zone === "head", ar.fromPlayer, "bow");
          ar.active = false;
        } else if (hit.hit === "piece" && hit.piece?.mat === "wood") {
          // stick in wood
          ar.x += ar.dx * Math.max(0, hit.dist - 0.05);
          ar.y += ar.dy * Math.max(0, hit.dist - 0.05);
          ar.z += ar.dz * Math.max(0, hit.dist - 0.05);
          ar.stuckIn = "wood";
          ar.stuckPieceId = hit.piece.id;
          ar.stuckTimer = 3;
        } else {
          ar.active = false;
        }
        continue;
      }
      ar.x += ar.dx * step;
      ar.y += ar.dy * step;
      ar.z += ar.dz * step;
    }
  }

  private updateSmoke(dt: number) {
    for (const s of this.smokeParticles) {
      if (!s.active) continue;
      s.life += dt;
      s.scale = Math.min(1.5, (s.life / s.maxLife) * 1.5);
      s.y += dt * 0.4;
      if (s.life >= s.maxLife) s.active = false;
    }
  }

  private explode(x: number, y: number, z: number, fromPlayer: boolean) {
    const w = WEAPONS.rocket;
    const radius = w.blastRadius ?? 4.5;
    this.spawnImpact(x, y, z);
    this.spawnImpact(x, y + 0.6, z);
    Sfx.explosion();
    const victims = fromPlayer ? this.botActors() : [this.player];
    for (const target of victims) {
      const cy = target.y + target.height * 0.5;
      const dist = Math.hypot(target.x - x, cy - y, target.z - z);
      if (dist < radius && target.alive) {
        const falloff = 1 - dist / radius;
        this.applyDamage(target, w.damage * (0.35 + 0.65 * falloff), false, fromPlayer, w.name);
      }
    }
    const self = fromPlayer ? this.player : this.bot;
    const sd = Math.hypot(self.x - x, self.y + self.height * 0.5 - y, self.z - z);
    if (sd < radius) {
      this.shake = Math.min(1, this.shake + 0.8 * (1 - sd / radius));
      // knockback instead of self damage — keeps duels fast
      const l = Math.max(0.4, sd);
      self.vx += ((self.x - x) / l) * 9 * (1 - sd / radius);
      self.vy += 7 * (1 - sd / radius);
      self.vz += ((self.z - z) / l) * 9 * (1 - sd / radius);
      self.grounded = false;
    }
    for (const p of [...this.pieceList]) {
      const bb = pieceBounds(p);
      const px = clamp(x, bb.minX, bb.maxX);
      const py = clamp(y, bb.minY, bb.maxY);
      const pz = clamp(z, bb.minZ, bb.maxZ);
      const d = Math.hypot(px - x, py - y, pz - z);
      if (d < radius) this.damagePiece(p, w.buildDamage * (1 - d / radius));
    }
  }

  fireWeapon(
    shooter: Actor,
    target: Actor | Actor[],
    weaponId: WeaponId,
    isPlayer: boolean,
    accuracy = 1,
  ) {
    const w = WEAPONS[weaponId];
    // In third person the crosshair sits on the camera ray, so the player's
    // shots must start at the camera to land exactly where the crosshair is.
    const fromCam = isPlayer && this.camActive;
    const ox = fromCam ? this.camX : shooter.x;
    const oy = fromCam ? this.camY : this.eyeY(shooter);
    const oz = fromCam ? this.camZ : shooter.z;
    const cp = Math.cos(shooter.pitch);
    const baseX = -Math.sin(shooter.yaw) * cp;
    const baseY = Math.sin(shooter.pitch);
    const baseZ = -Math.cos(shooter.yaw) * cp;

    if (w.projectileSpeed) {
      if (weaponId === "bow" || weaponId === "crossbow") {
        this.spawnArrow(ox, oy - 0.1, oz, baseX, baseY, baseZ, w.projectileSpeed, isPlayer);
      } else if (weaponId === "rocket") {
        this.spawnRocket(ox, oy - 0.1, oz, baseX, baseY, baseZ, w.projectileSpeed, isPlayer);
      }
      shooter.shootAnim = 1;
      if (isPlayer) {
        if (this.online)
          this.netSend?.({
            t: "shot",
            x: ox,
            y: oy,
            z: oz,
            dx: baseX,
            dy: baseY,
            dz: baseZ,
            w: weaponId,
          });
        this.recoilPitch += w.recoil;
        this.shake = Math.min(1, this.shake + w.recoil * 3);
      }
      Sfx.shoot(weaponId);
      if (weaponId === "bow" || weaponId === "crossbow" || weaponId === "rocket") {
        return { anyHit: false, anyHead: false };
      }
      // For high-speed sniper rifles, simulate ballistics with slight drop
    }

    const moving = Math.hypot(shooter.vx, shooter.vz) > 1.5 || !shooter.grounded;
    let spread = (w.spread + (moving ? w.moveSpread : 0)) / (this.scoped && isPlayer ? 3 : 1);
    spread /= accuracy;

    // 10-pellet deterministic Fortnite shotgun pattern (center + inner diamond + outer circle)
    const SHOTGUN_PATTERN: Array<[number, number]> = [
      [0, 0], // 0: dead center
      [-0.45, 0], // 1: inner left
      [0.45, 0], // 2: inner right
      [0, 0.45], // 3: inner top
      [0, -0.45], // 4: inner bottom
      [-0.75, 0.75], // 5: outer top-left
      [0.75, 0.75], // 6: outer top-right
      [-0.75, -0.75], // 7: outer bottom-left
      [0.75, -0.75], // 8: outer bottom-right
      [0, 0.9], // 9: outer crown
    ];

    if (isPlayer) this.aim.countShot();
    let anyHit = false;
    let anyHead = false;
    for (let i = 0; i < w.pellets; i++) {
      let sx: number;
      let sy: number;
      if (w.pellets > 1 && i < SHOTGUN_PATTERN.length) {
        const [px, py] = SHOTGUN_PATTERN[i]!;
        sx = (px + (Math.random() - 0.5) * 0.15) * spread;
        sy = (py + (Math.random() - 0.5) * 0.15) * spread;
      } else {
        sx = (Math.random() - 0.5) * spread * 2;
        sy = (Math.random() - 0.5) * spread * 2;
      }
      // offset in camera space
      const rightX = Math.cos(shooter.yaw);
      const rightZ = -Math.sin(shooter.yaw);
      let dx = baseX + rightX * sx;
      let dy = baseY + sy;
      let dz = baseZ + rightZ * sx;
      const len = Math.hypot(dx, dy, dz);
      dx /= len;
      dy /= len;
      dz /= len;

      const hit = this.raycast(ox, oy, oz, dx, dy, dz, w.range, shooter, target);
      if (isPlayer && this.aim.active) {
        const th = this.aim.rayHit(ox, oy, oz, dx, dy, dz, hit.dist);
        if (th) {
          this.spawnTracer(ox, oy - 0.15, oz, th.x, th.y, th.z, 0x9ef7ff);
          this.spawnImpact(th.x, th.y, th.z);
          Sfx.hit();
          hudStore.set({ lastHit: performance.now() });
          continue;
        }
      }
      const endX = ox + dx * hit.dist;
      const endY = oy + dy * hit.dist;
      const endZ = oz + dz * hit.dist;
      if (i === 0 || w.pellets <= 3)
        this.spawnTracer(ox, oy - 0.15, oz, endX, endY, endZ, isPlayer ? 0x9ef7ff : 0xff8080);

      if (hit.hit === "actor") {
        const falloff =
          hit.dist > w.falloffStart
            ? clamp(1 - ((hit.dist - w.falloffStart) / (w.range - w.falloffStart)) * 0.6, 0.4, 1)
            : 1;
        const mult = hit.zone === "head" ? w.headMult : hit.zone === "legs" ? w.legMult : 1;
        const victim = hit.actor ?? (Array.isArray(target) ? target[0] : target);
        if (victim)
          this.applyDamage(
            victim,
            w.damage * mult * falloff,
            hit.zone === "head",
            isPlayer,
            w.name,
          );
        if (w.melee) Sfx.pickaxeFlesh();
        anyHit = true;
        if (hit.zone === "head") anyHead = true;
      } else if (hit.hit === "piece" && hit.piece) {
        this.damagePiece(hit.piece, w.buildDamage);
        this.spawnImpact(endX, endY, endZ);
        if (w.melee) {
          Sfx.pickaxeHit();
          if (isPlayer) this.farmMat(hit.piece.mat);
        }
      } else if (hit.hit === "world") {
        this.spawnImpact(endX, endY, endZ);
        if (w.melee) {
          Sfx.pickaxeHit();
          if (isPlayer) this.farmMat("wood");
        }
      }
    }

    shooter.shootAnim = 1;
    if (isPlayer && this.online) {
      this.netSend?.({
        t: "shot",
        x: ox,
        y: oy,
        z: oz,
        dx: baseX,
        dy: baseY,
        dz: baseZ,
        w: weaponId,
      });
    }
    if (isPlayer) {
      this.recoilPitch += w.recoil;
      this.recoilYaw += (Math.random() - 0.5) * w.recoilH * 2;
      this.shake = Math.min(1, this.shake + w.recoil * 3);
      Sfx.shoot(weaponId);
    } else {
      spatialSfx(() => Sfx.shoot(weaponId), shooter.x, shooter.y + 1.2, shooter.z);
    }
    return { anyHit, anyHead };
  }

  // ---- weapon handling ----------------------------------------------------
  switchWeapon(id: WeaponId) {
    if (id === this.weapon || this.switchTimer > 0) return;
    this.prevWeapon = this.weapon;
    this.weapon = id;
    this.switchTimer = WEAPONS[id].switchTime;
    this.reloadTimer = 0;
    this.scoped = false;
    Sfx.switchWeapon();
  }

  startReload() {
    const rt = this.runtime[this.weapon];
    const w = WEAPONS[this.weapon];
    if (w.melee) return;
    if (this.reloadTimer > 0 || rt.ammo >= w.mag || rt.reserve <= 0) return;
    this.reloadTimer = w.reloadTime;
    this.scoped = false;
    Sfx.reload();
  }

  private finishReload() {
    const rt = this.runtime[this.weapon];
    const w = WEAPONS[this.weapon];
    const need = w.mag - rt.ammo;
    const take = Math.min(need, rt.reserve);
    rt.ammo += take;
    rt.reserve -= take;
  }

  // ---- main update --------------------------------------------------------
  update(dt: number) {
    dt = Math.min(dt, 0.05);
    const s = settingsStore.get();
    this.fpsAccum += dt;
    this.fpsFrames++;

    if (this.state === "countdown") {
      this.countdownTimer = (performance.now() - this.countdownStart) / 1000;
      const remain = 3 - this.countdownTimer;
      const tick = Math.ceil(remain);
      if (tick < this.lastCountdownTick) {
        this.lastCountdownTick = tick;
        Sfx.countdown(tick <= 0);
      }
      this.countdown = Math.max(0, tick);
      if (this.countdownTimer >= 3.7) {
        this.state = "live";
        this.countdown = -1;
        this.liveStart = performance.now();
      }
    }

    const live = this.state === "live";
    if (this.state === "roundEnd" || this.state === "matchEnd") {
      this.roundEndTimer += dt;
    }
    if (live) this.roundTime = (performance.now() - this.liveStart) / 1000;

    // Record replay frame (ring buffer, ~60fps = 10s at 600 frames)
    if (this.replayCapturing) {
      const opponent = this.bot; // use bot as opponent (works for both online and offline)
      const frame = this.replayBuffer[this.replayIdx % 600]!;
      frame.t = performance.now();
      frame.px = this.player.x;
      frame.py = this.player.y;
      frame.pz = this.player.z;
      frame.pyaw = this.player.yaw;
      frame.ppitch = this.player.pitch;
      frame.pHp = this.player.hp;
      frame.pShield = this.player.shield;
      frame.pAlive = this.player.alive;
      frame.bx = opponent.x;
      frame.by = opponent.y;
      frame.bz = opponent.z;
      frame.byaw = opponent.yaw;
      frame.bHp = opponent.hp;
      frame.bShield = opponent.shield;
      frame.weapon = this.weapon;
      this.replayIdx = (this.replayIdx + 1) % 600;
      this.replayCount = Math.min(600, this.replayCount + 1);
    }
    if (live && keyPressed("KeyH")) this.toggleAimTrainer();
    if (live) this.aim.update(dt);
    else if (this.aim.active) this.aim.stop();

    // ---- storm (Zone Wars) ------------------------------------------------
    if (this.gameMode === "zonewars" && live) {
      // Shrink the storm
      this.stormTimer += dt;
      const shrinkFraction = Math.min(1, this.stormTimer / STORM_SHRINK_DURATION);
      this.stormRadius =
        STORM_INITIAL_RADIUS - (STORM_INITIAL_RADIUS - STORM_FINAL_RADIUS) * shrinkFraction;

      // Apply damage to actors outside the storm
      const actors = [this.player, ...this.botActors()];
      let playerInStorm = false;
      for (const actor of actors) {
        if (!actor.alive) continue;
        const dist = Math.hypot(actor.x - this.stormCenterX, actor.z - this.stormCenterZ);
        if (dist > this.stormRadius) {
          if (actor === this.player) {
            this.stormDamageAccum += STORM_DAMAGE_PER_SEC * dt;
            if (this.stormDamageAccum >= 1) {
              const dmg = Math.floor(this.stormDamageAccum);
              this.stormDamageAccum -= dmg;
              this.applyDamage(this.player, dmg, false, false, "Storm");
            }
            playerInStorm = true;
          } else {
            // bots take simple instant damage per tick, applied locally
            actor.hp -= STORM_DAMAGE_PER_SEC * dt;
            if (actor.hp <= 0 && actor.alive) {
              actor.hp = 0;
              actor.alive = false;
              this.onKill(true, false, "Storm");
            }
          }
        }
      }
      hudStore.set({ stormRadius: this.stormRadius, inStorm: playerInStorm });
    }

    // ---- look (per-mode sensitivity multipliers)
    const modeMult = this.scoped
      ? s.adsSensitivity
      : this.buildMode || this.editMode
        ? s.buildSensitivity
        : 1;
    const sens = 0.0021 * s.sensitivity * modeMult;
    const invert = s.invertY ? -1 : 1;
    this.player.yaw -= input.mouseDX * sens;
    this.player.pitch -= input.mouseDY * sens * invert;

    if (input.lookX || input.lookY) {
      this.player.yaw -= input.lookX * sens * 12;
      this.player.pitch -= input.lookY * sens * 12 * invert;
      input.lookX = 0;
      input.lookY = 0;
      this.touchLook = 1;
    }
    this.touchLook = Math.max(0, this.touchLook - dt * 0.4);
    // gentle touch aim assist: nudges the crosshair toward a nearby enemy
    if (s.touchAimAssist && this.touchLook > 0 && !this.buildMode && !this.editMode) {
      const t = this.nearestBot();
      if (t && t.alive) {
        const dx = t.x - this.player.x;
        const dz = t.z - this.player.z;
        const dy = t.y + 0.9 - (this.player.y + 1.55);
        const dist = Math.hypot(dx, dz);
        if (dist < 55) {
          const wantYaw = Math.atan2(-dx, -dz);
          const wantPitch = Math.atan2(dy, dist);
          let dYaw = wantYaw - this.player.yaw;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          if (Math.abs(dYaw) < 0.22) {
            const k = 1 - Math.exp(-3.2 * dt);
            this.player.yaw += dYaw * k * 0.7;
            this.player.pitch += (wantPitch - this.player.pitch) * k * 0.5;
          }
        }
      }
    }
    this.player.pitch = clamp(this.player.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);

    this.recoilPitch = damp(this.recoilPitch, 0, 9, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 9, dt);
    this.shake = damp(this.shake, 0, 7, dt);

    // Update 3D audio listener position each frame
    setAudioListener(this.player.x, this.player.y + 1.6, this.player.z, this.player.yaw);

    if (live || this.state === "countdown") this.updatePlayer(dt);
    if (live && this.online) this.updateRemote(dt);
    else if (live) this.updateBots(dt);
    else {
      for (const b of this.botActors()) {
        b.vx = 0;
        b.vz = 0;
        b.vy -= MOVE.gravity * dt;
        this.moveActor(b, dt);
      }
    }

    this.updateRockets(dt);
    this.updateArrows(dt);
    this.updateSmoke(dt);

    // effects

    for (const t of this.tracers) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
    }
    for (const im of this.impacts) {
      if (!im.active) continue;
      im.life -= dt;
      if (im.life <= 0) im.active = false;
    }
    for (const fx of this.buildBreaks) {
      if (!fx.active) continue;
      fx.life -= dt;
      if (fx.life <= 0) fx.active = false;
    }

    this.player.shootAnim = damp(this.player.shootAnim, 0, 14, dt);
    for (const b of this.botActors()) b.shootAnim = damp(b.shootAnim, 0, 14, dt);

    // round transitions
    if ((this.state === "roundEnd" || this.state === "matchEnd") && this.roundEndTimer > 3) {
      if (this.state === "roundEnd") {
        if (!this.online || this.isHost) {
          this.startRound();
          if (this.online) this.netSend?.({ t: "round" });
        } else if (this.roundEndTimer > 6) {
          this.startRound();
        }
      }
    }

    if (this.online) {
      this.netTimer -= dt;
      if (this.netTimer <= 0) {
        this.netTimer = 0.05;
        const p = this.player;
        this.netSend?.({
          t: "s",
          x: p.x,
          y: p.y,
          z: p.z,
          yw: p.yaw,
          pt: p.pitch,
          vy: p.vy,
          sp: p.speed,
          gr: p.grounded,
          hh: p.height,
          hp: p.hp,
          sh: p.shield,
          al: p.alive,
          an: p.shootAnim,
        });
      }
    }

    this.syncHud(dt);
    endFrame();
  }

  private updatePlayer(dt: number) {
    const a = this.player;
    const live = this.state === "live";
    if (!a.alive) {
      a.vx = 0;
      a.vz = 0;
      a.vy -= MOVE.gravity * dt;
      this.moveActor(a, dt);
      return;
    }

    // ---- mode toggles
    const set = settingsStore.get();
    const enterBuild = (type: BuildType) => {
      if (this.editMode) this.exitEdit(true);
      if (this.buildMode && this.buildType === type) {
        // pressing the active piece again drops back to the weapon (Fortnite feel)
        this.buildMode = false;
      } else {
        this.buildMode = true;
        this.buildType = type;
        this.rotOffset = 0;
      }
      this.scoped = false;
      Sfx.switchWeapon();
    };
    if (actionPressed("buildWall")) enterBuild("wall");
    else if (actionPressed("buildRamp")) enterBuild("ramp");
    else if (actionPressed("buildFloor")) enterBuild("floor");
    else if (actionPressed("buildRoof")) enterBuild("roof");
    else if (actionPressed("build")) {
      if (this.editMode) this.exitEdit(true);
      this.buildMode = !this.buildMode;
      this.scoped = false;
      Sfx.switchWeapon();
    }

    if (actionPressed("cycleMat")) this.cycleMaterial(1);

    if (!set.disablePreEdit) {
      if (actionPressed("edit")) {
        if (this.editMode) {
          // Debounce: don't immediately confirm on the entry frame
          if (performance.now() - this.editEnteredAt > 150) {
            this.exitEdit(true);
          }
        } else {
          this.tryEnterEdit();
        }
      } else if (set.editHold && this.editMode && !actionDown("edit")) {
        // Only exit on key release if player held it for at least 180ms
        if (performance.now() - this.editEnteredAt > 180) {
          this.exitEdit(true);
        }
      }
    }

    // number keys always go back to a weapon (like the classic 1v1 controls),
    // build pieces stay on their own keys + mouse wheel
    {
      const lo = this.loadout;
      for (let i = 0; i < lo.length; i++) {
        if (keyPressed(`Digit${i + 1}`)) {
          if (this.editMode) this.exitEdit(false);
          this.buildMode = false;
          this.switchWeapon(lo[i]!);
        }
      }
    }

    if (this.editMode && input.wheel !== 0) {
      this.resetEditedPiece();
    } else if (this.buildMode) {
      if (actionPressed("rotate")) {
        this.rotOffset = (this.rotOffset + 1) % 4;
        Sfx.switchWeapon();
      }
      if (input.wheel !== 0) {
        const idx = BUILD_ORDER.indexOf(this.buildType);
        this.buildType = BUILD_ORDER[(idx + (input.wheel > 0 ? 1 : -1) + 4) % 4]!;
        this.rotOffset = 0;
      }
    } else {
      const lo = this.loadout;

      if (input.wheel !== 0 && lo.length > 0) {
        const idx = Math.max(0, lo.indexOf(this.weapon));
        const next = (idx + (input.wheel > 0 ? 1 : -1) + lo.length) % lo.length;
        this.switchWeapon(lo[next]!);
      }
      if (actionPressed("prevWeapon")) this.switchWeapon(this.prevWeapon);
      // Tab cycles through the slots like Fortnite's quick swap
      if (keyPressed("Tab") && lo.length > 0) {
        const idx = Math.max(0, lo.indexOf(this.weapon));
        this.switchWeapon(lo[(idx + 1) % lo.length]!);
      }
    }

    // ---- movement
    const wantSprint =
      actionDown("sprint") && this.stamina > 1 && !this.buildMode && !this.editMode;
    const wantCrouch = actionDown("crouch");
    let crouch = wantCrouch;
    // Check headroom before allowing player to stand up
    if (!wantCrouch && a.crouching) {
      const standBox: AABB = {
        minX: a.x - MOVE.radius,
        maxX: a.x + MOVE.radius,
        minY: a.y,
        maxY: a.y + MOVE.height,
        minZ: a.z - MOVE.radius,
        maxZ: a.z + MOVE.radius,
      };
      const cols = this.gatherNearby(a);
      for (const c of cols) {
        if (overlaps(standBox, c)) {
          crouch = true;
          break;
        }
      }
    }
    a.crouching = crouch;
    const targetHeight = crouch ? MOVE.crouchHeight : MOVE.height;
    a.height = damp(a.height, targetHeight, 18, dt);

    let ix = 0;
    let iz = 0;
    if (actionDown("forward")) iz -= 1;
    if (actionDown("back")) iz += 1;
    if (actionDown("left")) ix -= 1;
    if (actionDown("right")) ix += 1;
    ix += input.moveX;
    iz += input.moveZ;
    const ilen = Math.hypot(ix, iz);
    if (ilen > 1) {
      ix /= ilen;
      iz /= ilen;
    }

    const sin = Math.sin(a.yaw);
    const cos = Math.cos(a.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    const wishX = -sin * -iz + cos * ix;
    const wishZ = -cos * -iz - sin * ix;

    // ---- power slide: sprint + crouch keeps momentum, low friction, short window
    const hSpeed = Math.hypot(a.vx, a.vz);
    this.slideCd = Math.max(0, this.slideCd - dt);
    if (this.slideTime > 0) {
      this.slideTime -= dt;
      if (!a.grounded || hSpeed < 3.2 || !crouch) this.slideTime = 0;
    } else if (
      crouch &&
      a.grounded &&
      hSpeed > 6 &&
      this.slideCd <= 0 &&
      !this.buildMode &&
      !this.editMode
    ) {
      this.slideTime = 0.55;
      this.slideCd = 1.1;
      const boost = Math.min(MOVE.sprintSpeed * 1.45, hSpeed * 1.28);
      a.vx = (a.vx / hSpeed) * boost;
      a.vz = (a.vz / hSpeed) * boost;
      this.shake = Math.min(1, this.shake + 0.2);
      Sfx.step();
    }
    const sliding = this.slideTime > 0;

    const sprinting = wantSprint && iz < -0.1 && a.grounded && !crouch;
    if (sprinting) this.stamina = Math.max(0, this.stamina - MOVE.staminaDrain * dt);
    else this.stamina = Math.min(MOVE.staminaMax, this.stamina + MOVE.staminaRegen * dt);

    const maxSpeed = sliding
      ? MOVE.sprintSpeed * 1.5
      : crouch
        ? MOVE.crouchSpeed
        : sprinting
          ? MOVE.sprintSpeed
          : MOVE.walkSpeed;

    if (a.grounded) {
      const friction = sliding
        ? 1.6
        : ilen > 0.01
          ? MOVE.groundFriction * 0.5
          : MOVE.groundFriction;
      a.vx = damp(a.vx, 0, friction, dt);
      a.vz = damp(a.vz, 0, friction, dt);
      const accel = sliding ? MOVE.groundAccel * 0.18 : MOVE.groundAccel;
      a.vx += wishX * accel * dt;
      a.vz += wishZ * accel * dt;
      const sp = Math.hypot(a.vx, a.vz);
      if (sp > maxSpeed) {
        a.vx = (a.vx / sp) * maxSpeed;
        a.vz = (a.vz / sp) * maxSpeed;
      }
    } else {
      // air strafing: limited acceleration, keeps momentum
      const sp = Math.hypot(a.vx, a.vz);
      const proj = a.vx * wishX + a.vz * wishZ;
      const addSpeed = maxSpeed * MOVE.airControl - proj;
      if (addSpeed > 0) {
        const accel = Math.min(MOVE.airAccel * dt * maxSpeed * 0.14, addSpeed);
        a.vx += wishX * accel;
        a.vz += wishZ * accel;
      }
      if (sp > maxSpeed * 1.6) {
        a.vx *= 0.995;
        a.vz *= 0.995;
      }
    }

    // jump w/ coyote + buffer (+ hold-to-bhop)
    if (actionPressed("jump") || (actionDown("jump") && a.grounded))
      this.jumpBuffer = MOVE.jumpBuffer;
    this.jumpBuffer -= dt;
    if (a.grounded) this.coyote = MOVE.coyoteTime;
    else this.coyote -= dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && live) {
      a.vy = MOVE.jumpVelocity * (this.slideTime > 0 ? 0.94 : 1);
      this.slideTime = 0;
      a.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      // keep (slightly boost) horizontal momentum for fluid bunny hops
      const hs = Math.hypot(a.vx, a.vz);
      if (hs > 0.5) {
        const cap = MOVE.sprintSpeed * 1.25;
        const boosted = Math.min(hs * MOVE.jumpBoost, cap);
        a.vx = (a.vx / hs) * boosted;
        a.vz = (a.vz / hs) * boosted;
      }
      Sfx.jump();
    }

    // gravity with apex hang time, fast fall and short-hop cut
    let gScale = 1;
    if (a.vy > 0 && !actionDown("jump")) gScale = MOVE.jumpCutGravity;
    else if (Math.abs(a.vy) < MOVE.apexWindow) gScale = MOVE.apexGravity;
    else if (a.vy < 0) gScale = MOVE.fallGravity;
    a.vy -= MOVE.gravity * gScale * dt;
    if (a.vy < -MOVE.maxFall) a.vy = -MOVE.maxFall;

    const wasAirborne = !a.grounded;
    const fallSpeed = -a.vy;
    this.moveActor(a, dt);
    if (wasAirborne && a.grounded && fallSpeed > 5) {
      // landing impact: knees give in, camera dips, harder landings shake more
      const impact = Math.min(1, (fallSpeed - 5) / 20);
      this.landDip = Math.min(0.42, this.landDip + 0.1 + impact * 0.3);
      this.shake = Math.min(1, this.shake + impact * 0.35);
      // heavy landings scrub a bit of speed, like real weight transfer
      const keep = 1 - impact * 0.22;
      a.vx *= keep;
      a.vz *= keep;
      Sfx.step();
    }
    this.landDip = damp(this.landDip, 0, 9, dt);
    // no strafe lean: the view must stay dead level while running
    this.viewLean = damp(this.viewLean, 0, 12, dt);
    a.speed = Math.hypot(a.vx, a.vz);
    a.animTime += dt * (0.5 + a.speed * 0.16);

    // footsteps
    if (a.grounded && a.speed > 1.5) {
      this.stepTimer -= dt * a.speed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 3.4;
        Sfx.step();
      }
    }

    this.bobTime += dt * (a.grounded ? a.speed * 1.1 : 0);

    // ---- edit mode interactions
    if (this.editMode) {
      if (!this.editPiece) {
        this.exitEdit(false);
        return;
      }
      const tile = this.updateEditAim();
      this.editAimTile = tile;
      if (tile >= 0 && input.firePressed) {
        this.dragSelectTarget = !this.editSelection[tile]; // cut out (false) or fill in (true)
        this.setEditTile(tile, this.dragSelectTarget);
        if (set.autoConfirmEdit && !set.editHold) {
          // Fortnite "edit on release": confirm as soon as the mouse is let go
          this.pendingEditConfirm = true;
        }
      } else if (tile >= 0 && input.fireDown && this.dragSelectTarget !== null) {
        // dragging across tiles applies the same cut/fill intent smoothly
        if (this.editSelection[tile] !== this.dragSelectTarget) {
          this.setEditTile(tile, this.dragSelectTarget);
          if (set.autoConfirmEdit && !set.editHold) {
            this.pendingEditConfirm = true;
          }
        }
      }
      if (!input.fireDown) {
        this.dragSelectTarget = null;
        if (this.pendingEditConfirm) {
          this.pendingEditConfirm = false;
          // Only auto-confirm if tiles were actually modified during this drag
          // AND the resulting shape is valid (or completely cut out).
          // If invalid (e.g. only 1 incomplete tile), do NOT exit edit mode!
          if (this.editTileChanged) {
            const shape = getEditShapeInfo(this.editPiece.type, this.editSelection);
            if (shape.valid || this.editSelection.every((t) => !t)) {
              this.exitEdit(true);
              return;
            }
          }
        }
      }
      if (input.altPressed) {
        // Right click in edit mode: resets tiles (Fortnite style)
        this.resetEditedPiece();
      }
      if (actionPressed("resetEdit")) this.resetEditedPiece();
      return;
    }
    this.editAimTile = -1;

    // ---- build mode interactions
    this.buildTimer -= dt;
    if (this.buildMode) {
      const g = this.computeGhost(a, this.buildType);
      this.ghost.visible = true;
      this.ghost.type = this.buildType;
      this.ghost.gx = g.gx;
      this.ghost.gy = g.gy;
      this.ghost.gz = g.gz;
      this.ghost.rot = g.rot;
      this.ghost.valid = this.ghostValid(this.buildType, g.gx, g.gy, g.gz, g.rot, "player");
      const wantPlace = set.turboBuild ? input.fireDown : input.firePressed;
      const cellKey = `${this.buildType}:${g.gx}:${g.gy}:${g.gz}:${g.rot}`;
      const newCell = cellKey !== this.lastPlacedCell;
      if (wantPlace && live && (this.buildTimer <= 0 || newCell)) {
        if (this.placeBuild("player", a, this.buildType)) {
          this.buildTimer = BUILD_COOLDOWN;
          this.lastPlacedCell = cellKey;
          // a ramp keeps the ramp selected, so tapping it never drops a wall behind it
          if (set.resetBuildChoice && this.buildType !== "ramp") this.buildType = "wall";
        } else {
          this.buildTimer = 0.05;
        }
      }
      if (!input.fireDown) this.lastPlacedCell = "";
      if (input.altPressed) this.buildMode = false;
      return;
    }

    this.ghost.visible = false;

    // ---- shooting
    this.switchTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      a.reloadAnim = 1;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.finishReload();
      }
    } else {
      a.reloadAnim = damp(a.reloadAnim, 0, 8, dt);
    }
    if (actionPressed("reload")) this.startReload();

    const w = WEAPONS[this.weapon];
    // the pickaxe has no sights: aiming is disabled for the melee tool
    if (w.melee) {
      this.scoped = false;
    } else if (set.adsToggle) {
      if (input.altPressed) this.scoped = !this.scoped;
    } else {
      // hold to aim: releasing the button leaves the sights immediately
      this.scoped = input.altDown;
    }

    this.fireTimer -= dt;

    // ---- Mini Shield: hold LMB 1.5s to drink
    if (this.weapon === "mini_shield" && live) {
      if (input.fireDown) {
        this.drinkTimer += dt;
        this.drinkProgress = Math.min(1, this.drinkTimer / 1.5);
        if (this.drinkTimer >= 1.5) {
          const rt = this.runtime["mini_shield"];
          if (rt.ammo > 0) {
            rt.ammo--;
            const gain = Math.min(25, 50 - a.shield);
            if (gain > 0) {
              a.shield += gain;
              Sfx.drink();
            }
          }
          this.drinkTimer = 0;
          this.drinkProgress = 0;
        }
      } else {
        this.drinkTimer = 0;
        this.drinkProgress = 0;
      }
    } else {
      this.drinkTimer = 0;
      this.drinkProgress = 0;
    }

    const wantsFire =
      this.weapon !== "mini_shield" && (w.auto ? input.fireDown : input.firePressed);
    if (
      wantsFire &&
      this.fireTimer <= 0 &&
      this.switchTimer <= 0 &&
      this.reloadTimer <= 0 &&
      live
    ) {
      const rt = this.runtime[this.weapon];
      if (w.melee) {
        this.fireTimer = 60 / w.rpm;
        this.fireWeapon(a, this.botActors(), this.weapon, true);
      } else if (rt.ammo > 0) {
        rt.ammo--;
        this.fireTimer = 60 / w.rpm;
        this.fireWeapon(a, this.botActors(), this.weapon, true);
      } else {
        this.startReload();
      }
    }
  }
  private jumpBuffer = 0;
  private coyote = 0;

  // ---- Bot ----------------------------------------------------------------
  private updateBots(dt: number) {
    if (this.botCount <= 0) return;
    this.updateBotUnit(this.bot, this.botTimers, dt);
    for (let i = 0; i < this.botCount - 1; i++) {
      const u = this.extraBots[i]!;
      this.updateBotUnit(u.a, u.timers, dt);
    }
  }

  private updateBotUnit(
    b: Actor,
    timers: { shoot: number; think: number; build: number; jump: number; strafe: number },
    dt: number,
  ) {
    const p = this.player;
    if (!b.alive) {
      b.vy -= MOVE.gravity * dt;
      this.moveActor(b, dt);
      return;
    }
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const dist = Math.hypot(dx, dz);
    const desiredYaw = Math.atan2(-dx, -dz);
    let diff = desiredYaw - b.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    b.yaw += clamp(diff, -this.skill.turn * dt, this.skill.turn * dt);

    const eyeDy = this.eyeY(p) - this.eyeY(b);
    const targetPitch = Math.atan2(eyeDy, Math.max(0.5, dist));
    b.pitch = damp(b.pitch, targetPitch, 10, dt);

    // line of sight
    const cp = Math.cos(b.pitch);
    const fx = -Math.sin(b.yaw) * cp;
    const fy = Math.sin(b.pitch);
    const fz = -Math.cos(b.yaw) * cp;
    const los = this.raycast(b.x, this.eyeY(b), b.z, fx, fy, fz, 120, b, p);
    const hasLos = los.hit === "actor" && Math.abs(diff) < 0.25;

    // movement
    timers.think -= dt;
    if (timers.think <= 0) {
      timers.think = 0.6 + Math.random() * 0.7;
      timers.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    const approach = dist > 14 ? 1 : dist < 7 ? -0.4 : 0.15;
    const sin = Math.sin(b.yaw);
    const cos = Math.cos(b.yaw);
    const strafe = hasLos ? timers.strafe : 0;
    const wishX = -sin * approach + cos * strafe;
    const wishZ = -cos * approach - sin * strafe;
    const speed = MOVE.walkSpeed * this.skill.speed;
    if (b.grounded) {
      b.vx = damp(b.vx, wishX * speed, 12, dt);
      b.vz = damp(b.vz, wishZ * speed, 12, dt);
    } else {
      b.vx = damp(b.vx, wishX * speed, 2, dt);
      b.vz = damp(b.vz, wishZ * speed, 2, dt);
    }

    timers.jump -= dt;
    if (b.grounded && timers.jump <= 0 && (hasLos ? Math.random() < 0.02 : Math.random() < 0.008)) {
      b.vy = MOVE.jumpVelocity;
      timers.jump = 1.2;
    }
    b.vy -= MOVE.gravity * dt;
    this.moveActor(b, dt);
    b.speed = Math.hypot(b.vx, b.vz);
    b.animTime += dt * (0.5 + b.speed * 0.16);

    // footsteps for bot
    if (b.grounded && b.speed > 1.5) {
      if (!(b as any)._stepTimer) (b as any)._stepTimer = 0;
      (b as any)._stepTimer -= dt * b.speed;
      if ((b as any)._stepTimer <= 0) {
        (b as any)._stepTimer = 3.4;
        spatialSfx(() => Sfx.step(), b.x, b.y + 0.1, b.z);
      }
    }

    // building: cover when hurt / ramp when far
    timers.build -= dt;
    if (timers.build <= 0) {
      const hurt = b.hp + b.shield < 140;
      if (hurt && Math.random() < 0.35 + this.skill.build * 0.5) {
        this.placeBuild("enemy", b, "wall");
        timers.build = 1.6;
      } else if (dist > 16 && Math.random() < this.skill.build) {
        this.placeBuild("enemy", b, Math.random() < 0.5 ? "ramp" : "wall");
        timers.build = 2.2;
      } else {
        timers.build = 1.0;
      }
    }

    // shooting
    timers.shoot -= dt;
    // scope glint: a sniping enemy gives away its position with a lens flare
    const sniping = dist > 26 && hasLos;
    b.glint = sniping ? Math.min(1, b.glint + dt * 3) : Math.max(0, b.glint - dt * 1.6);
    if (hasLos && timers.shoot <= 0) {
      const weapon: WeaponId =
        dist < 9
          ? Math.random() < 0.5
            ? "shotgun"
            : "tacshotgun"
          : dist > 26
            ? "sniper"
            : "rifle";

      const w = WEAPONS[weapon];
      timers.shoot =
        60 / w.rpm + (weapon === "rifle" ? 0.02 : 0.25) + this.skill.react + Math.random() * 0.12;
      this.fireWeapon(b, p, weapon, false, 0.55 * this.botDifficulty * this.skill.spread);
    } else if (!hasLos && los.hit === "piece" && los.piece && timers.shoot <= 0) {
      // shoot through obstructing builds in measured bursts
      if (Math.random() < 0.45) {
        timers.shoot = 0.85 + Math.random() * 0.4;
        this.fireWeapon(b, p, "rifle", false, 0.5);
      } else {
        timers.shoot = 0.5;
      }
    }
  }

  // ---- online opponent -----------------------------------------------------
  private updateRemote(dt: number) {
    const b = this.bot;
    const r = this.remote;
    if (!r) {
      b.vx = 0;
      b.vz = 0;
      return;
    }
    const k = 1 - Math.exp(-18 * dt);
    b.x += (r.x - b.x) * k;
    b.y += (r.y - b.y) * k;
    b.z += (r.z - b.z) * k;
    b.yaw = r.yaw;
    b.pitch = r.pitch;
    b.vy = r.vy;
    b.grounded = r.grounded;
    b.height = r.height;
    b.speed = r.speed;
    b.animTime += dt * (0.5 + r.speed * 0.16);
  }

  applyNetMessage(m: Record<string, unknown> & { t: string }) {
    const n = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
    switch (m.t) {
      case "s": {
        this.remote = {
          x: n(m["x"]),
          y: n(m["y"]),
          z: n(m["z"]),
          yaw: n(m["yw"]),
          pitch: n(m["pt"]),
          vy: n(m["vy"]),
          speed: n(m["sp"]),
          grounded: Boolean(m["gr"]),
          height: n(m["hh"], MOVE.height),
          hp: n(m["hp"], PLAYER_MAX_HP),
          shield: n(m["sh"]),
          alive: m["al"] !== false,
          shoot: n(m["an"]),
        };
        const b = this.bot;
        b.hp = this.remote.hp;
        b.shield = this.remote.shield;
        b.alive = this.remote.alive;
        b.shootAnim = Math.max(b.shootAnim, this.remote.shoot);
        if (this.state !== "live") {
          b.x = this.remote.x;
          b.y = this.remote.y;
          b.z = this.remote.z;
        }
        break;
      }
      case "dmg": {
        this.applyDamage(this.player, n(m["a"]), Boolean(m["h"]), false, String(m["w"] ?? "Waffe"));
        break;
      }
      case "shot": {
        const w = WEAPONS[(m["w"] as WeaponId) in WEAPONS ? (m["w"] as WeaponId) : "rifle"];
        const ox = n(m["x"]);
        const oy = n(m["y"]);
        const oz = n(m["z"]);
        const dx = n(m["dx"]);
        const dy = n(m["dy"]);
        const dz = n(m["dz"]);
        if (w.projectileSpeed) {
          this.spawnRocket(ox, oy, oz, dx, dy, dz, w.projectileSpeed, false);
          this.bot.shootAnim = 1;
          Sfx.shoot("rocket");
          break;
        }
        const hit = this.raycast(ox, oy, oz, dx, dy, dz, w.range, this.bot, null);
        this.spawnTracer(
          ox,
          oy - 0.15,
          oz,
          ox + dx * hit.dist,
          oy + dy * hit.dist,
          oz + dz * hit.dist,
          0xff8080,
        );
        this.bot.shootAnim = 1;
        Sfx.shoot((m["w"] as WeaponId) ?? "rifle");
        break;
      }
      case "b": {
        const type = m["bt"] as BuildType;
        const gx = n(m["gx"]);
        const gy = n(m["gy"]);
        const gz = n(m["gz"]);
        const rot = n(m["r"]);
        const key = pieceKey(type, gx, gy, gz, rot);
        const existing = this.pieces.get(key);
        if (existing) this.removePiece(existing, true);
        const netMat = String(m["mt"] ?? "wood") as MatId;
        const piece = createPiece(type, gx, gy, gz, rot, "enemy", MATS[netMat] ? netMat : "wood");
        this.pieces.set(key, piece);
        this.pieceList.push(piece);
        this.bumpBuilds();
        spatialSfx(() => Sfx.build(), gx * CELL, gy * CELL, gz * CELL);
        break;
      }
      case "rm": {
        const p = this.pieces.get(String(m["k"]));
        if (p) this.removePiece(p, true);
        break;
      }
      case "e": {
        const p = this.pieces.get(String(m["k"]));
        const tiles = m["tiles"];
        if (p && Array.isArray(tiles)) {
          p.tiles = tiles.map((t) => Boolean(t));
          p.colliders = computeColliders(p);
          p.version++;
          this.bumpBuilds();
        }
        break;
      }
      case "died": {
        if (this.state === "live") {
          this.bot.alive = false;
          this.bot.hp = 0;
          this.onKill(true, false, "Duell");
        }
        break;
      }
      case "round": {
        if (this.state === "roundEnd") this.startRound();
        break;
      }
      case "leave": {
        this.online = false;
        break;
      }
    }
  }

  // ---- HUD ----------------------------------------------------------------
  private syncHud(dt: number) {
    this.hudTimer -= dt;
    if (this.hudTimer > 0) return;
    this.hudTimer = 0.06;
    const rt = this.runtime[this.weapon];
    const now = performance.now();
    const feed = this.killFeed.filter((k) => now - k.t < 6000);
    const dmg = this.damageNumbers.filter((d) => now - d.t < 900);
    let fps = hudStore.get().fps;
    if (this.fpsAccum > 0.5) {
      fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
    hudStore.set({
      hp: Math.max(0, Math.round(this.player.hp)),
      shield: Math.max(0, Math.round(this.player.shield)),
      stamina: Math.round(this.stamina),
      weapon: this.weapon,
      ammo: rt.ammo,
      reserve: rt.reserve,
      reloading: this.reloadTimer > 0,
      drinkProgress: this.drinkProgress,
      buildMode: this.buildMode,
      editMode: this.editMode,
      buildType: this.buildType,
      material: this.material,
      matWood: this.mats.wood,
      matStone: this.mats.stone,
      matMetal: this.mats.metal,
      editPieceType: this.editPiece?.type ?? null,
      editTiles: this.editSelection.slice(),
      editPieceTiles: this.editPieceTilesSnapshot(),
      editAimTile: this.editAimTile,
      scoped: this.scoped,
      enemyHp: Math.max(0, Math.round((this.nearestBot() ?? this.bot).hp)),
      enemyShield: Math.max(0, Math.round((this.nearestBot() ?? this.bot).shield)),
      botsAlive: this.aliveBots().length,
      botCount: this.online ? 1 : this.botCount,
      roundTime: this.roundTime,
      countdown: this.countdown,
      scoreYou: this.scoreYou,
      scoreEnemy: this.scoreEnemy,
      fps,
      killFeed: feed.length !== hudStore.get().killFeed.length ? feed : hudStore.get().killFeed,
      damageNumbers:
        dmg.length !== hudStore.get().damageNumbers.length ? dmg : hudStore.get().damageNumbers,
    });
    if (feed.length !== this.killFeed.length) this.killFeed = feed;
    if (dmg.length !== this.damageNumbers.length) this.damageNumbers = dmg;
  }
}

export const engine = new Engine();

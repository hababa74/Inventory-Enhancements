// Core tuning constants for ARENA:ONE — all values are game-design tuned.

export const CELL = 4; // grid cell size in meters
export const WALL_T = 0.3; // wall / floor thickness

// ---- Movement -------------------------------------------------------------
export const MOVE = {
  walkSpeed: 7.2,
  sprintSpeed: 9.6,
  crouchSpeed: 3.6,
  groundAccel: 90,
  groundFriction: 11,
  airAccel: 34,
  airControl: 0.95,
  gravity: 26,
  jumpVelocity: 9.7,
  maxFall: 60,
  apexGravity: 0.6, // floatier at the top of the arc
  apexWindow: 2.4, // |vy| below this counts as apex
  fallGravity: 1.3, // snappier descent
  jumpCutGravity: 2.4, // released space = short hop
  jumpBoost: 1.12, // horizontal momentum kept/boosted on take-off
  stepHeight: 0.55,
  radius: 0.42,
  height: 1.8,
  crouchHeight: 1.15,
  eyeOffset: 0.18, // below top of the capsule
  coyoteTime: 0.13,
  jumpBuffer: 0.17,
  staminaMax: 100,
  staminaDrain: 22,
  staminaRegen: 16,
};

// ---- Weapons --------------------------------------------------------------
export type WeaponId =
  | "pickaxe"
  | "shotgun"       // Pump
  | "tacshotgun"    // Taktische Shotgun
  | "rifle"         // FN-SCAR
  | "smg"           // MP5
  | "sniper"        // Bolt-Action Sniper
  | "pistol"        // Glock-19
  | "rocket"        // RPG
  | "ak47"          // AK-47
  | "m4a1"          // M4-A1
  | "deagle"        // Desert Eagle
  | "crossbow"      // Crossbow
  | "bow"           // Bow
  | "heavy_sniper"  // Heavy Sniper
  | "minigun"       // Minigun
  | "mac10"         // MAC-10
  | "mini_shield";  // Mini Shield

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: number;
  damage: number;
  pellets: number;
  rpm: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  spread: number; // radians
  moveSpread: number;
  recoil: number; // vertical kick in radians
  recoilH: number;
  range: number;
  falloffStart: number;
  headMult: number;
  legMult: number;
  auto: boolean;
  scope?: number; // scoped FOV
  buildDamage: number;
  switchTime: number;
  color: string;
  /** rocket-style projectile */
  projectileSpeed?: number;
  blastRadius?: number;
  /** short marketing-ish label for the loadout screen */
  role: string;
  /** melee tool: infinite uses, short reach, strong against structures */
  melee?: boolean;
}


// Damage model tuned to a battle-royale build-fighter feel:
// 100 HP + 100 shield, headshot x1.5 (sniper x2), no leg reduction.
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pickaxe: {
    id: "pickaxe",
    role: "Immer dabei · Bauteile abbauen",
    name: "Spitzhacke",
    slot: 0,
    damage: 20,
    pellets: 1,
    rpm: 105,
    mag: 1,
    reserve: 0,
    reloadTime: 0,
    spread: 0,
    moveSpread: 0,
    recoil: 0.01,
    recoilH: 0.002,
    range: 3.2,
    falloffStart: 3.2,
    headMult: 1,
    legMult: 1,
    auto: true,
    buildDamage: 55,
    switchTime: 0.2,
    color: "#9fd8ff",
    melee: true,
  },
  shotgun: {
    id: "shotgun",
    role: "Nahkampf-Pumpgun",
    name: "Pump-Schrotflinte",
    slot: 1,
    damage: 10, // 10 pellets = 100 body / 150 head at close range
    pellets: 10,
    rpm: 42,
    mag: 5,
    reserve: 35,
    reloadTime: 2.3,
    spread: 0.05,
    moveSpread: 0.008,
    recoil: 0.06,
    recoilH: 0.012,
    range: 40,
    falloffStart: 6,
    headMult: 1.5,
    legMult: 1,
    auto: false,
    buildDamage: 10, // ~100 structure damage with all pellets
    switchTime: 0.35,
    color: "#c07dff",
  },
  tacshotgun: {
    id: "tacshotgun",
    role: "Schnelle Taktik-Shotgun",
    name: "Taktische Schrotflinte",
    slot: 2,
    damage: 8.3, // 10 pellets = 83 body
    pellets: 10,
    rpm: 120,
    mag: 8,
    reserve: 48,
    reloadTime: 0.55, // shell-by-shell feel
    spread: 0.065,
    moveSpread: 0.01,
    recoil: 0.035,
    recoilH: 0.009,
    range: 32,
    falloffStart: 5,
    headMult: 1.5,
    legMult: 1,
    auto: false,
    buildDamage: 8,
    switchTime: 0.3,
    color: "#ffb347",
  },
  rifle: {
    id: "rifle",
    role: "Allrounder auf Distanz",
    name: "Sturmgewehr",
    slot: 3,
    damage: 33,
    pellets: 1,
    rpm: 330,
    mag: 30,
    reserve: 150,
    reloadTime: 2.1,
    spread: 0.011,
    moveSpread: 0.022,
    recoil: 0.014,
    recoilH: 0.005,
    range: 160,
    falloffStart: 55,
    headMult: 1.5,
    legMult: 1,
    auto: true,
    buildDamage: 30,
    switchTime: 0.3,
    color: "#4ee6ff",
  },
  smg: {
    id: "smg",
    role: "Hohe Feuerrate",
    name: "MP",
    slot: 4,
    damage: 19,
    pellets: 1,
    rpm: 600,
    mag: 30,
    reserve: 180,
    reloadTime: 2.0,
    spread: 0.021,
    moveSpread: 0.016,
    recoil: 0.009,
    recoilH: 0.006,
    range: 90,
    falloffStart: 24,
    headMult: 1.5,
    legMult: 1,
    auto: true,
    buildDamage: 22,
    switchTime: 0.24,
    color: "#a6ff6e",
  },
  sniper: {
    id: "sniper",
    role: "Ein-Schuss-Präzision",
    name: "Scharfschützengewehr",
    slot: 5,
    damage: 116,
    pellets: 1,
    rpm: 36,
    mag: 3,
    reserve: 12,
    reloadTime: 2.5,
    spread: 0.0012,
    moveSpread: 0.04,
    recoil: 0.075,
    recoilH: 0.008,
    range: 1200,
    falloffStart: 1200,
    headMult: 2.0,
    legMult: 1,
    auto: false,
    scope: 32,
    buildDamage: 120,
    projectileSpeed: 240,
    switchTime: 0.45,
    color: "#ff6ea6",
  },
  pistol: {
    id: "pistol",
    role: "Leichte Zweitwaffe",
    name: "Pistole",
    slot: 6,
    damage: 25,
    pellets: 1,
    rpm: 400,
    mag: 16,
    reserve: 96,
    reloadTime: 1.4,
    spread: 0.012,
    moveSpread: 0.018,
    recoil: 0.016,
    recoilH: 0.004,
    range: 80,
    falloffStart: 28,
    headMult: 1.5,
    legMult: 1,
    auto: false,
    buildDamage: 24,
    switchTime: 0.22,
    color: "#c9d4ff",
  },
  rocket: {
    id: "rocket",
    role: "Explosiver Flächenschaden",
    name: "Raketenwerfer",
    slot: 7,
    damage: 100,
    pellets: 1,
    rpm: 40,
    mag: 1,
    reserve: 6,
    reloadTime: 2.9,
    spread: 0.004,
    moveSpread: 0.01,
    recoil: 0.05,
    recoilH: 0.006,
    range: 220,
    falloffStart: 220,
    headMult: 1,
    legMult: 1,
    auto: false,
    buildDamage: 200,
    switchTime: 0.5,
    color: "#ffcf5c",
    projectileSpeed: 42,
    blastRadius: 4.6,
  },
  ak47: {
    id: "ak47",
    role: "Klassisches Sturmgewehr · Hoher Einzelschaden",
    name: "AK-47",
    slot: 8,
    damage: 36,
    pellets: 1,
    rpm: 320,
    mag: 30,
    reserve: 150,
    reloadTime: 2.3,
    spread: 0.014,
    moveSpread: 0.024,
    recoil: 0.022,
    recoilH: 0.008,
    range: 180,
    falloffStart: 60,
    headMult: 1.5,
    legMult: 1,
    auto: true,
    buildDamage: 38,
    switchTime: 0.32,
    color: "#d28a38",
  },
  m4a1: {
    id: "m4a1",
    role: "Taktischer Karabiner · Präzise & leise",
    name: "M4-A1",
    slot: 9,
    damage: 30,
    pellets: 1,
    rpm: 380,
    mag: 30,
    reserve: 150,
    reloadTime: 1.9,
    spread: 0.008,
    moveSpread: 0.018,
    recoil: 0.012,
    recoilH: 0.004,
    range: 170,
    falloffStart: 65,
    headMult: 1.5,
    legMult: 1,
    auto: true,
    buildDamage: 32,
    switchTime: 0.28,
    color: "#424754",
  },
  deagle: {
    id: "deagle",
    role: "Schwere Handfeuerwaffe · Hohe Durchschlagskraft",
    name: "Desert Eagle",
    slot: 10,
    damage: 75,
    pellets: 1,
    rpm: 130,
    mag: 7,
    reserve: 35,
    reloadTime: 1.8,
    spread: 0.008,
    moveSpread: 0.018,
    recoil: 0.048,
    recoilH: 0.009,
    range: 110,
    falloffStart: 45,
    headMult: 2.0,
    legMult: 1,
    auto: false,
    buildDamage: 75,
    switchTime: 0.25,
    color: "#e2e8f0",
  },
  crossbow: {
    id: "crossbow",
    role: "Lautlose Bolzen · Präzision",
    name: "Crossbow",
    slot: 11,
    damage: 85,
    pellets: 1,
    rpm: 65,
    mag: 5,
    reserve: 25,
    reloadTime: 2.1,
    spread: 0.002,
    moveSpread: 0.02,
    recoil: 0.014,
    recoilH: 0.002,
    range: 300,
    falloffStart: 300,
    headMult: 2.0,
    legMult: 1,
    auto: false,
    scope: 36,
    buildDamage: 60,
    switchTime: 0.35,
    color: "#a38258",
  },
  bow: {
    id: "bow",
    role: "Traditioneller Bogen · Geräuschlos",
    name: "Bow",
    slot: 12,
    damage: 90,
    pellets: 1,
    rpm: 48,
    mag: 1,
    reserve: 30,
    reloadTime: 1.1,
    spread: 0.001,
    moveSpread: 0.015,
    recoil: 0.01,
    recoilH: 0.001,
    range: 260,
    falloffStart: 260,
    headMult: 2.0,
    legMult: 1,
    auto: false,
    buildDamage: 50,
    switchTime: 0.28,
    color: "#eab308",
  },
  heavy_sniper: {
    id: "heavy_sniper",
    role: "Anti-Material Kaliber .50 · Durchschlägt Wände",
    name: "Heavy Sniper",
    slot: 13,
    damage: 150,
    pellets: 1,
    rpm: 22,
    mag: 1,
    reserve: 10,
    reloadTime: 3.8,
    spread: 0.0005,
    moveSpread: 0.045,
    recoil: 0.12,
    recoilH: 0.015,
    range: 1500,
    falloffStart: 1500,
    headMult: 2.5,
    legMult: 1,
    auto: false,
    scope: 28,
    buildDamage: 600,
    projectileSpeed: 320,
    switchTime: 0.55,
    color: "#3b6d3b",
  },
  minigun: {
    id: "minigun",
    role: "Rotierende Läufe · Unendlicher Dauerbeschuss",
    name: "Minigun",
    slot: 14,
    damage: 21,
    pellets: 1,
    rpm: 780,
    mag: 150,
    reserve: 300,
    reloadTime: 3.4,
    spread: 0.026,
    moveSpread: 0.038,
    recoil: 0.008,
    recoilH: 0.007,
    range: 140,
    falloffStart: 35,
    headMult: 1.4,
    legMult: 1,
    auto: true,
    buildDamage: 42,
    switchTime: 0.6,
    color: "#334155",
  },
  mac10: {
    id: "mac10",
    role: "Kompakte Maschinenpistole · Höchste Feuerrate",
    name: "MAC-10",
    slot: 15,
    damage: 17,
    pellets: 1,
    rpm: 880,
    mag: 32,
    reserve: 192,
    reloadTime: 1.6,
    spread: 0.032,
    moveSpread: 0.02,
    recoil: 0.017,
    recoilH: 0.011,
    range: 65,
    falloffStart: 18,
    headMult: 1.4,
    legMult: 1,
    auto: true,
    buildDamage: 20,
    switchTime: 0.18,
    color: "#475569",
  },
  mini_shield: {
    id: "mini_shield",
    role: "+25 Schild · Schnelle Regeneration",
    name: "Mini Shield",
    slot: 16,
    damage: 0,
    pellets: 1,
    rpm: 60,
    mag: 2,
    reserve: 4,
    reloadTime: 1.5,
    spread: 0,
    moveSpread: 0,
    recoil: 0,
    recoilH: 0,
    range: 1,
    falloffStart: 1,
    headMult: 1,
    legMult: 1,
    auto: false,
    buildDamage: 0,
    switchTime: 0.25,
    color: "#38bdf8",
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  "rifle",
  "shotgun",
  "pistol",
  "sniper",
  "mini_shield",
  "ak47",
  "m4a1",
  "deagle",
  "rocket",
  "crossbow",
  "bow",
  "heavy_sniper",
  "minigun",
  "mac10",
  "smg",
  "tacshotgun",
];
/** Weapons the player can pick in the pre-match loadout. */
export const LOADOUT_SLOTS = 3;
/** Always-available melee tool, occupying slot 1 in every loadout. */
export const MELEE_WEAPON: WeaponId = "pickaxe";

export type BuildType = "wall" | "ramp" | "floor" | "roof";
export const BUILD_ORDER: BuildType[] = ["wall", "ramp", "floor", "roof"];
/** Structure HP, matching a wood-tier build. */
export const BUILD_HP = 150;
export const BUILD_COOLDOWN = 0.06;

export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_SHIELD = 100;


// ---- build materials (Fortnite-style wood / stone / metal) -----------------
export type MatId = "wood" | "stone" | "metal";

export interface MatDef {
  id: MatId;
  name: string;
  /** structure HP once fully built */
  hp: number;
  /** color used for the built piece */
  color: string;
  /** short HUD label */
  short: string;
}

export const MATS: Record<MatId, MatDef> = {
  wood: { id: "wood", name: "HOLZ", hp: 150, color: "#c08a4a", short: "H" },
  stone: { id: "stone", name: "STEIN", hp: 260, color: "#9aa4ae", short: "S" },
  metal: { id: "metal", name: "METALL", hp: 400, color: "#79d2e8", short: "M" },
};

export const MAT_ORDER: MatId[] = ["wood", "stone", "metal"];
/** material spent per placed piece */
export const MAT_COST = 10;
/** material you start a round with */
export const MAT_START = 500;
export const MAT_CAP = 999;
/** material gained per pickaxe hit on the world */
export const MAT_FARM = 12;

// ---- Character presentation ----------------------------------------------
/**
 * One fixed visual size for every fighter, in lobby, locker and match, so
 * skins can never look bigger/smaller than each other.
 */
export const FIGHTER = {
  /** rendered height in metres (collision capsule stays MOVE.height) */
  visualHeight: 1.94,
  /** procedural suit is modelled at MOVE.height, so scale it to match */
  get proceduralScale() {
    return this.visualHeight / 1.8;
  },
};

// ---- Third person camera --------------------------------------------------
export const TPS = {
  /** pivot height above the feet */
  pivotY: 1.5,
  /** shoulder offset to the right of the view */
  side: 0.68,
  distance: 3.15,
  adsSide: 0.5,
  adsDistance: 1.7,
  buildDistance: 3.75,
  buildPivotY: 1.62,
  /** exponential smoothing rates */
  followRate: 22,
  distanceRate: 14,
};

// ---- Game Modes -----------------------------------------------------------
export type GameMode = "duel" | "zonewars" | "ffa" | "doubles" | "boxfight" | "br_solo" | "sandbox";

export interface GameModeInfo {
  id: GameMode;
  name: string;
  badge: string;
  sub: string;
  desc: string;
  image: string;
  unlimitedMats: boolean;
  defaultMap: string;
  bots: number;
}

export const GAME_MODES: Record<GameMode, GameModeInfo> = {
  duel: {
    id: "duel",
    name: "1v1 DUEL",
    badge: "1v1",
    sub: "DUELS",
    desc: "1v1 Modus ist ein Solo-Duell, bei dem zwei Spieler bauen, kämpfen und sich in einer geschlossenen Arena messen.",
    image: "/modes/duel.jpg",
    unlimitedMats: false,
    defaultMap: "nexus",
    bots: 1,
  },
  zonewars: {
    id: "zonewars",
    name: "Zone Wars",
    badge: "Zone Wars",
    sub: "NEW MODE",
    desc: "Kämpfe auf Dächern und Bauten, während sich der tödliche Sturm rasant zusammenzieht. Schnelligkeit und Highground entscheiden!",
    image: "/modes/zonewars.jpg",
    unlimitedMats: true,
    defaultMap: "nexus",
    bots: 1,
  },
  boxfight: {
    id: "boxfight",
    name: "1v1 BOX",
    badge: "1v1 BOX",
    sub: "BOX-FIGHT",
    desc: "Reines Nahkampf-Duell in einer vorgebauten Holzkiste mit Schrotflinten und schnellen Edits. Keine Fluchtmöglichkeit!",
    image: "/modes/boxfight.jpg",
    unlimitedMats: true,
    defaultMap: "nexus",
    bots: 1,
  },
  ffa: {
    id: "ffa",
    name: "FFA",
    badge: "FFA",
    sub: "FREE FOR ALL",
    desc: "Jeder gegen jeden! Trete in einer offenen Arena gegen mehrere Bots an. Wer die meisten Kills holt, gewinnt das Match.",
    image: "/modes/ffa.jpg",
    unlimitedMats: false,
    defaultMap: "grassbox",
    bots: 5,
  },
  doubles: {
    id: "doubles",
    name: "2v2",
    badge: "2v2",
    sub: "DOUBLES",
    desc: "Zwei-gegen-Zwei Teamkampf. Baue Schutz für deinen Partner und übersteht gemeinsam das Kreuzfeuer der Gegner.",
    image: "/modes/doubles.jpg",
    unlimitedMats: true,
    defaultMap: "nexus",
    bots: 3,
  },
  br_solo: {
    id: "br_solo",
    name: "Solo BR",
    badge: "Solo",
    sub: "Battle Royale",
    desc: "Große Wüsten-Canyon-Map mit Storm, Loot und weiten Distanzen. Der letzte Überlebende holt den Sieg!",
    image: "/modes/solo.jpg",
    unlimitedMats: false,
    defaultMap: "desert",
    bots: 4,
  },
  sandbox: {
    id: "sandbox",
    name: "Sandbox",
    badge: "Sandbox",
    sub: "Practice Builds",
    desc: "Freier Übungsmodus mit unbegrenzten Materialien, Parkour, Zielen und freiem Bauen ohne gegnerischen Druck.",
    image: "/modes/sandbox.jpg",
    unlimitedMats: true,
    defaultMap: "training",
    bots: 0,
  },
};

// Storm / Zone Wars constants
export const STORM_INITIAL_RADIUS = 32;      // meters from center
export const STORM_FINAL_RADIUS   = 5;       // smallest the storm gets
export const STORM_SHRINK_DURATION = 90;     // seconds to shrink fully
export const STORM_DAMAGE_PER_SEC = 8;       // HP damage per second outside storm
export const STORM_WARNING_DIST   = 5;       // meters inside edge to show warning

// Box Fight pre-built arena size (in grid cells)
export const BOXFIGHT_SIZE = 3;             // 3x3 cells box
export const BOXFIGHT_HEIGHT = 3;           // 3 cells tall

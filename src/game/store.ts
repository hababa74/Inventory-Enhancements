import { useSyncExternalStore } from "react";
import { MAT_START, WEAPON_ORDER, type BuildType, type MatId, type WeaponId } from "./constants";

export type Screen = "menu" | "lobby" | "playing" | "paused" | "roundEnd" | "matchEnd";

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  t: number;
}

export interface ReplayFrame {
  t: number;
  // Player (local)
  px: number;
  py: number;
  pz: number;
  pyaw: number;
  ppitch: number;
  pHp: number;
  pShield: number;
  pAlive: boolean;
  // Opponent (bot/remote)
  bx: number;
  by: number;
  bz: number;
  byaw: number;
  bHp: number;
  bShield: number;
  weapon: string;
}

export interface HudState {
  killCamActive: boolean;
  killCamFrames: ReplayFrame[] | null;
  killCamDuration: number;
  screen: Screen;
  countdown: number; // 3..0, 0 = GO, -1 = inactive
  hp: number;
  shield: number;
  stamina: number;
  weapon: WeaponId;
  loadout: WeaponId[];
  ammo: number;
  reserve: number;
  reloading: boolean;
  buildMode: boolean;
  editMode: boolean;
  buildType: BuildType;
  material: MatId;
  matWood: number;
  matStone: number;
  matMetal: number;
  editPieceType: BuildType | null;
  editTiles: boolean[];
  editPieceTiles: boolean[];
  editAimTile: number;
  scoped: boolean;
  aimTrainer: {
    available: boolean;
    active: boolean;
    hits: number;
    shots: number;
    timeLeft: number;
    best: number;
    lastHits: number | null;
    lastShots: number | null;
  };
  botsAlive: number;
  botCount: number;
  scoreYou: number;
  scoreEnemy: number;
  enemyHp: number;
  enemyShield: number;
  roundTime: number;
  killFeed: KillFeedEntry[];
  lastHit: number;
  lastHitStructure: boolean;
  lastHeadshot: number;
  /** last hit was absorbed by shield */
  lastHitArmor: boolean;
  /** distance of the last confirmed hit in metres */
  lastHitDist: number;
  /** timestamp of the last hit that downed a target */
  lastHitDown: number;
  roundResult: "win" | "loss" | null;
  matchResult: "win" | "loss" | null;
  fps: number;
  connection: "local" | "connecting" | "connected" | "lost";
  roomCode: string;
  opponentName: string;
  opponentSkin: string;
  ping: number;
  damageNumbers: Array<{
    id: number;
    amount: number;
    head: boolean;
    armor: boolean;
    dist: number;
    t: number;
  }>;
  rankPopup: {
    mmrBefore: number;
    mmrAfter: number;
    rankBefore: string;
    rankAfter: string;
    rankUp: boolean;
  } | null;
  gameMode: import("./constants").GameMode;
  stormRadius: number;
  stormActive: boolean;
  inStorm: boolean;
  drinkProgress: number;
}

export const initialHud: HudState = {
  killCamActive: false,
  killCamFrames: null,
  killCamDuration: 0,
  screen: "menu",
  countdown: -1,
  gameMode: "duel",
  stormRadius: 32,
  stormActive: false,
  inStorm: false,
  drinkProgress: 0,
  hp: 100,
  shield: 100,
  stamina: 100,
  weapon: "rifle",
  loadout: ["rifle", "shotgun", "sniper"],
  ammo: 30,
  reserve: 120,
  reloading: false,
  buildMode: false,
  editMode: false,
  buildType: "wall",
  material: "wood",
  matWood: MAT_START,
  matStone: MAT_START,
  matMetal: MAT_START,
  editPieceType: null,
  editTiles: [true, true, true, true, true, true, true, true, true],
  editPieceTiles: [true, true, true, true, true, true, true, true, true],
  editAimTile: -1,
  scoped: false,
  aimTrainer: {
    available: false,
    active: false,
    hits: 0,
    shots: 0,
    timeLeft: 60,
    best: 0,
    lastHits: null,
    lastShots: null,
  },
  botsAlive: 1,
  botCount: 1,
  scoreYou: 0,
  scoreEnemy: 0,
  enemyHp: 100,
  enemyShield: 100,
  roundTime: 0,
  killFeed: [],
  lastHit: 0,
  lastHitStructure: false,
  lastHeadshot: 0,
  lastHitArmor: false,
  lastHitDist: 0,
  lastHitDown: 0,
  roundResult: null,
  matchResult: null,
  fps: 0,
  connection: "local",
  roomCode: "",
  opponentName: "NOVA-BOT",
  opponentSkin: "cyberblade",
  ping: 0,
  damageNumbers: [],
  rankPopup: null,
};

type Listener = () => void;

class Store<T extends object> {
  private state: T;
  private listeners = new Set<Listener>();
  constructor(initial: T) {
    this.state = initial;
  }
  get(): T {
    return this.state;
  }
  set(patch: Partial<T>) {
    let changed = false;
    for (const k in patch) {
      const next = (patch as Record<string, unknown>)[k];
      const prev = (this.state as Record<string, unknown>)[k];
      if (prev !== next) {
        // Fast shallow equality for arrays to eliminate JSON.stringify GC spikes
        if (Array.isArray(prev) && Array.isArray(next)) {
          if (prev.length !== next.length) {
            changed = true;
            break;
          }
          for (let i = 0; i < prev.length; i++) {
            if (prev[i] !== next[i]) {
              changed = true;
              break;
            }
          }
          if (changed) break;
        } else {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}

export const hudStore = new Store<HudState>(initialHud);

export function useHud<S>(selector: (s: HudState) => S): S {
  return useSyncExternalStore(
    hudStore.subscribe,
    () => selector(hudStore.get()),
    () => selector(initialHud),
  );
}

// ---- Settings -------------------------------------------------------------

export interface Settings {
  sensitivity: number;
  aimSensitivity: number;
  adsSensitivity: number;
  buildSensitivity: number;
  fov: number;
  invertY: boolean;
  invertX: boolean;
  /** true = Kamera hinter der Figur (Third Person), false = Ego-Perspektive */
  thirdPerson: boolean;
  /** true = aiming toggles on/off, false = hold the button to aim */
  adsToggle: boolean;
  toggleAim: boolean;
  showFps: boolean;
  graphicsPreset: "low" | "medium" | "high" | "ultra";
  quality: "low" | "medium" | "high";
  language: string;
  region: string;
  allowFrameCap: boolean;
  frameCap: number;
  antiAliasing: number;
  textureQuality: number;
  resolutionScale: number;
  showSpeedLines: boolean;
  shadows: boolean;
  effects: boolean;
  enableUIAnimations: boolean;
  viewDistance: number;
  fpsLimit: number;
  master: number;
  sfx: number;
  music: number;
  bestOf: number;
  /** bot strength for solo training, 1 (easy) .. 5 (hard) */
  botLevel: number;
  /** 0..5 bots in solo play */
  botCount: number;
  /** selected map id */
  mapId: string;
  /** locker */
  skin: string;
  /** owned cosmetic ids (free skins are always owned) */
  owned: string[];
  /** soft currency for the shop */
  coins: number;
  /** ISO week id of the last claimed weekly coin drop */
  weeklyClaimed: string;
  /** ranked ladder */
  mmr: number;
  wins: number;
  losses: number;
  /** battle pass */
  bpXp: number;
  bpClaimed: number[];
  bpPremium: boolean;
  /** daily challenges */
  dailyDate: string;
  dailyProgress: Record<string, number>;
  dailyClaimed: string[];
  playerName: string;

  /** weapons picked before a match; empty = randomly generated */
  loadout: WeaponId[];
  /** Fortnite-style build options */
  turboBuild: boolean;
  resetBuildChoice: boolean;
  editHold: boolean;
  autoConfirmEdit: boolean;
  disablePreEdit: boolean;
  keys: Record<string, string>;
  secondaryKeys: Record<string, string>;
  /** gameplay cosmetic / visual toggles */
  crosshairThickness: number;
  weaponBobbing: number;
  weaponLeaning: number;
  handsModelHeight: number;
  cameraAnimation: boolean;
  autoSprint: boolean;
  enableMuzzleFlash: boolean;
  autoPickupWeapons: boolean;
  showHitmarkNumbers: boolean;
  showAmmoUI: boolean;
  showHealthUI: boolean;
  showWeaponsUI: boolean;
  showMovementSpeedText: boolean;
  showMatchStats: boolean;
  showChat: boolean;
  showCrosshairDot: boolean;
  dynamicCrosshair: boolean;
  /** mobile / touch */
  touchSensitivity: number;
  hudScale: number;
  hudOpacity: number;
  leftHanded: boolean;
  touchAimAssist: boolean;
  hapticFeedback: boolean;
  gameMode: import("./constants").GameMode;
  unlimitedMats: boolean;
}

export const KEY_LABELS: Record<string, string> = {
  forward: "Vorwärts",
  back: "Rückwärts",
  left: "Links",
  right: "Rechts",
  jump: "Springen",
  sprint: "Sprinten",
  crouch: "Ducken",
  reload: "Nachladen",
  buildWall: "Wand bauen",
  buildRamp: "Treppe bauen",
  buildFloor: "Boden bauen",
  buildRoof: "Dach bauen",
  build: "Baumodus wechseln",
  edit: "Bearbeiten",
  rotate: "Bauteil drehen",
  resetEdit: "Bearbeitung zurücksetzen",
  prevWeapon: "Letzte Waffe",
  cycleMat: "Material wechseln",
};

export const DEFAULT_KEYS: Record<string, string> = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  sprint: "ShiftLeft",
  crouch: "ControlLeft",
  reload: "KeyR",
  buildWall: "KeyQ",
  buildRamp: "KeyV",
  buildFloor: "KeyC",
  buildRoof: "KeyF",
  build: "KeyE",
  edit: "KeyG",
  rotate: "KeyR",
  resetEdit: "KeyT",
  prevWeapon: "KeyX",
  cycleMat: "KeyZ",
};

export const DEFAULT_SECONDARY_KEYS: Record<string, string> = {
  forward: "ArrowUp",
  back: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

export const defaultSettings: Settings = {
  sensitivity: 0.35,
  aimSensitivity: 1.0,
  adsSensitivity: 0.6,
  buildSensitivity: 1.2,
  fov: 75,
  invertY: false,
  invertX: false,
  thirdPerson: true,
  adsToggle: false,
  toggleAim: false,
  showFps: true,
  graphicsPreset: "high",
  quality: "high",
  language: "de",
  region: "eu2",
  allowFrameCap: false,
  frameCap: 999,
  antiAliasing: 1,
  textureQuality: 1,
  resolutionScale: 1.0,
  showSpeedLines: false,
  shadows: true,
  effects: true,
  enableUIAnimations: true,
  viewDistance: 220,
  fpsLimit: 0,
  master: 1.0,
  sfx: 1.0,
  music: 0.8,
  bestOf: 5,
  botLevel: 3,
  botCount: 1,
  mapId: "nexus",
  skin: "ogmodel",
  owned: ["ogmodel", "cyberblade"],
  coins: 500,
  weeklyClaimed: "",
  mmr: 0,
  wins: 0,
  losses: 0,
  bpXp: 0,
  bpClaimed: [],
  bpPremium: false,
  dailyDate: "",
  dailyProgress: {},
  dailyClaimed: [],

  playerName: "",
  loadout: [],
  turboBuild: true,
  resetBuildChoice: false,
  editHold: false,
  autoConfirmEdit: true,
  disablePreEdit: false,
  keys: { ...DEFAULT_KEYS },
  secondaryKeys: { ...DEFAULT_SECONDARY_KEYS },
  crosshairThickness: 2.0,
  weaponBobbing: 0.5,
  weaponLeaning: 1.0,
  handsModelHeight: 0.0,
  cameraAnimation: true,
  autoSprint: true,
  enableMuzzleFlash: true,
  autoPickupWeapons: true,
  showHitmarkNumbers: true,
  showAmmoUI: true,
  showHealthUI: true,
  showWeaponsUI: true,
  showMovementSpeedText: false,
  showMatchStats: true,
  showChat: true,
  showCrosshairDot: true,
  dynamicCrosshair: true,
  touchSensitivity: 1.0,
  hudScale: 1.0,
  hudOpacity: 1.0,
  leftHanded: false,
  touchAimAssist: true,
  hapticFeedback: true,
  gameMode: "duel",
  unlimitedMats: false,
};

const KEY = "arena-one-settings";

function load(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const s: Settings = {
      ...defaultSettings,
      ...parsed,
      keys: { ...DEFAULT_KEYS, ...(parsed.keys ?? {}) },
      secondaryKeys: { ...DEFAULT_SECONDARY_KEYS, ...(parsed.secondaryKeys ?? {}) },
    };
    // Migrate old default from cyberblade to the authentic 1v1.lol ogmodel
    if (parsed.skin === "cyberblade" && (!parsed.owned || parsed.owned.length <= 1)) {
      s.skin = "ogmodel";
    }
    if (!s.owned.includes("ogmodel")) {
      s.owned = ["ogmodel", ...s.owned];
    }
    return s;
  } catch {
    return defaultSettings;
  }
}

export const settingsStore = new Store<Settings>(defaultSettings);

export function hydrateSettings() {
  settingsStore.set(load());
}

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set(patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settingsStore.get()));
  } catch {
    /* storage unavailable */
  }
}

export function useSettings<S>(selector: (s: Settings) => S): S {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.get()),
    () => selector(defaultSettings),
  );
}

export const weaponOrder = WEAPON_ORDER;

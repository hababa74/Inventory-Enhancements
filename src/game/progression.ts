/**
 * Season progression: battle pass tiers, daily challenges and the ranked
 * rating update. All state lives in the persisted settings store so progress
 * survives reloads.
 */

import { settingsStore, updateSettings, hudStore } from "./store";
import { applyResult, rankFor } from "./ranks";

// ---- battle pass ----------------------------------------------------------

export const SEASON_NAME = "SEASON 1 // NEXUS RISING";
export const MAX_TIER = 100;
export const XP_PER_TIER = 1000;

export type RewardKind = "coins" | "skin" | "spray" | "title" | "banner" | "boost";

export interface Reward {
  kind: RewardKind;
  label: string;
  coins?: number;
  skinId?: string;
  premium: boolean;
}

/** skins handed out through the pass (already exist in the locker) */
const PASS_SKINS: Array<[number, string]> = [[100, "cyberblade"]];

const SPRAYS = ["Neon-Schädel", "Rampen-König", "Bau-Meister", "Kopfschuss", "Doppel-Edit", "Turbo-Tap"];
const TITLES = ["Duellant", "Wandbrecher", "Boxfighter", "Highground-Jäger", "Nexus-Veteran", "Arena-Legende"];
const BANNERS = ["Splitterglas", "Hexgitter", "Plasmawelle", "Sturmfront", "Kobalt-Kreis", "Signalfeuer"];

function buildTiers(): Reward[] {
  const skinAt = new Map(PASS_SKINS);
  const out: Reward[] = [];
  for (let lvl = 1; lvl <= MAX_TIER; lvl++) {
    const skin = skinAt.get(lvl);
    if (skin) {
      out.push({ kind: "skin", label: `Skin: ${skin.toUpperCase()}`, skinId: skin, premium: lvl >= 50 });
      continue;
    }
    if (lvl % 25 === 0) {
      out.push({ kind: "boost", label: "XP-Boost +25% (Bonus)", coins: 500, premium: true });
      continue;
    }
    if (lvl % 5 === 0) {
      out.push({ kind: "coins", label: "500 Coins", coins: 500, premium: false });
      continue;
    }
    const m = lvl % 4;
    if (m === 1) out.push({ kind: "coins", label: "150 Coins", coins: 150, premium: false });
    else if (m === 2) out.push({ kind: "spray", label: `Spray: ${SPRAYS[lvl % SPRAYS.length]}`, premium: false });
    else if (m === 3) out.push({ kind: "banner", label: `Banner: ${BANNERS[lvl % BANNERS.length]}`, premium: lvl > 40 });
    else out.push({ kind: "title", label: `Titel: ${TITLES[lvl % TITLES.length]}`, premium: lvl > 60 });
  }
  return out;
}

export const TIER_REWARDS = buildTiers();

export function rewardFor(level: number): Reward | null {
  return TIER_REWARDS[level - 1] ?? null;
}

export function levelFromXp(xp: number): number {
  return Math.min(MAX_TIER, Math.floor(xp / XP_PER_TIER) + 1);
}

export function xpIntoLevel(xp: number): number {
  if (xp >= MAX_TIER * XP_PER_TIER) return XP_PER_TIER;
  return xp % XP_PER_TIER;
}

export function addXp(amount: number) {
  if (amount <= 0) return;
  const s = settingsStore.get();
  const mult = s.bpPremium ? 1.25 : 1;
  const xp = Math.min(MAX_TIER * XP_PER_TIER, Math.round(s.bpXp + amount * mult));
  updateSettings({ bpXp: xp });
}

/** claims one unlocked tier; returns a short message for the UI */
export function claimTier(level: number): string {
  const s = settingsStore.get();
  if (levelFromXp(s.bpXp) < level) return "Stufe noch nicht erreicht.";
  if (s.bpClaimed.includes(level)) return "Bereits abgeholt.";
  const r = rewardFor(level);
  if (!r) return "Keine Belohnung.";
  if (r.premium && !s.bpPremium) return "Nur im Premium-Pass.";
  const patch: Partial<import("./store").Settings> = { bpClaimed: [...s.bpClaimed, level] };
  if (r.coins) patch.coins = s.coins + r.coins;
  if (r.skinId && !s.owned.includes(r.skinId)) patch.owned = [...s.owned, r.skinId];

  updateSettings(patch);
  return `${r.label} freigeschaltet!`;
}

export const PREMIUM_PRICE = 4000;

export function buyPremium(): string {
  const s = settingsStore.get();
  if (s.bpPremium) return "Premium bereits aktiv.";
  if (s.coins < PREMIUM_PRICE) return "Nicht genug Coins.";
  updateSettings({ bpPremium: true, coins: s.coins - PREMIUM_PRICE });
  return "Premium-Pass aktiviert!";
}

// ---- daily challenges -----------------------------------------------------

export type StatKey =
  | "kills"
  | "headshots"
  | "sniperKills"
  | "shotgunKills"
  | "rocketKills"
  | "builds"
  | "edits"
  | "wins"
  | "matches"
  | "rounds";

export interface Challenge {
  id: string;
  text: string;
  stat: StatKey;
  goal: number;
  xp: number;
  coins: number;
}

const CHALLENGE_POOL: Challenge[] = [
  { id: "kills10", text: "Schalte 10 Gegner aus", stat: "kills", goal: 10, xp: 500, coins: 75 },
  { id: "kills25", text: "Schalte 25 Gegner aus", stat: "kills", goal: 25, xp: 900, coins: 150 },
  { id: "head3", text: "Lande 3 Kopfschüsse", stat: "headshots", goal: 3, xp: 400, coins: 60 },
  { id: "head8", text: "Lande 8 Kopfschüsse", stat: "headshots", goal: 8, xp: 800, coins: 120 },
  { id: "snipe2", text: "2 Kills mit dem Scharfschützengewehr", stat: "sniperKills", goal: 2, xp: 450, coins: 70 },
  { id: "shotgun5", text: "5 Kills mit einer Schrotflinte", stat: "shotgunKills", goal: 5, xp: 450, coins: 70 },
  { id: "rocket2", text: "2 Kills mit dem Raketenwerfer", stat: "rocketKills", goal: 2, xp: 500, coins: 80 },
  { id: "build60", text: "Platziere 60 Bauteile", stat: "builds", goal: 60, xp: 350, coins: 50 },
  { id: "build150", text: "Platziere 150 Bauteile", stat: "builds", goal: 150, xp: 700, coins: 110 },
  { id: "edit20", text: "Führe 20 Edits aus", stat: "edits", goal: 20, xp: 400, coins: 60 },
  { id: "win2", text: "Gewinne 2 Duelle", stat: "wins", goal: 2, xp: 750, coins: 125 },
  { id: "match3", text: "Spiele 3 Matches", stat: "matches", goal: 3, xp: 300, coins: 50 },
  { id: "rounds10", text: "Gewinne 10 Runden", stat: "rounds", goal: 10, xp: 600, coins: 90 },
];

export const DAILY_COUNT = 3;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** deterministic per-day selection so every session shows the same set */
export function dailyChallenges(date = todayKey()): Challenge[] {
  const pool = [...CHALLENGE_POOL];
  const out: Challenge[] = [];
  let seed = hash(date);
  for (let i = 0; i < DAILY_COUNT && pool.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0]!);
  }
  return out;
}

/** resets progress when the day rolled over */
export function ensureDailyFresh() {
  const s = settingsStore.get();
  const key = todayKey();
  if (s.dailyDate === key) return;
  updateSettings({ dailyDate: key, dailyProgress: {}, dailyClaimed: [] });
}

export function msUntilReset(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** records gameplay progress against today's challenges */
export function trackStat(stat: StatKey, amount = 1) {
  ensureDailyFresh();
  const s = settingsStore.get();
  const active = dailyChallenges(s.dailyDate);
  let changed = false;
  const progress = { ...s.dailyProgress };
  for (const c of active) {
    if (c.stat !== stat) continue;
    const cur = progress[c.id] ?? 0;
    if (cur >= c.goal) continue;
    progress[c.id] = Math.min(c.goal, cur + amount);
    changed = true;
  }
  if (changed) updateSettings({ dailyProgress: progress });
}

export function challengeProgress(id: string): number {
  return settingsStore.get().dailyProgress[id] ?? 0;
}

export function claimChallenge(id: string): string {
  ensureDailyFresh();
  const s = settingsStore.get();
  const c = dailyChallenges(s.dailyDate).find((x) => x.id === id);
  if (!c) return "Unbekannte Herausforderung.";
  if (s.dailyClaimed.includes(id)) return "Bereits abgeholt.";
  if ((s.dailyProgress[id] ?? 0) < c.goal) return "Noch nicht abgeschlossen.";
  updateSettings({ dailyClaimed: [...s.dailyClaimed, id], coins: s.coins + c.coins });
  addXp(c.xp);
  return `+${c.xp} XP · ${c.coins} Coins`;
}

// ---- coin economy ---------------------------------------------------------

/** coins wagered per online duel: the winner takes them from the loser */
export const MATCH_STAKE = 150;
/** extra reward on top of the stake for winning a duel */
export const WIN_BONUS = 100;
/** small consolation payout for beating a training bot */
export const BOT_WIN_COINS = 40;
/** free weekly coin drop, claimable in the shop */
export const WEEKLY_COINS = 750;

/** ISO-like year+week key, e.g. "2026-W36" */
export function weekId(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weeklyReady(): boolean {
  return settingsStore.get().weeklyClaimed !== weekId();
}

/** seconds until the next weekly drop unlocks */
export function weeklyResetIn(): number {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + (8 - day));
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function claimWeekly(): string {
  const s = settingsStore.get();
  const id = weekId();
  if (s.weeklyClaimed === id) return "Wochenbonus schon abgeholt — komm nächste Woche wieder.";
  updateSettings({ coins: s.coins + WEEKLY_COINS, weeklyClaimed: id });
  return `Wochenbonus abgeholt: +${WEEKLY_COINS} Coins.`;
}

// ---- match results --------------------------------------------------------

export interface MatchSummary {
  won: boolean;
  mmrBefore: number;
  mmrAfter: number;
  xp: number;
  /** coins won (positive) or lost (negative) in this match */
  coins: number;
  rankBefore: string;
  rankAfter: string;
  rankUp: boolean;
  rankDown: boolean;
}

/** applies elo, win/loss record, xp and challenge progress after a match */
export function recordMatch(won: boolean, opponentMmr?: number, online = false): MatchSummary {
  const s = settingsStore.get();
  const before = s.mmr;
  const after = applyResult(before, opponentMmr ?? before, won);
  // real stakes: an online duel moves coins from the loser to the winner
  const coins = online
    ? won
      ? MATCH_STAKE + WIN_BONUS
      : -Math.min(MATCH_STAKE, s.coins)
    : won
      ? BOT_WIN_COINS
      : 0;
  const coinPatch: Partial<import('./store').Settings> = {
    coins: Math.max(0, s.coins + coins),
  };
  if (online) {
    coinPatch.mmr = after;
    coinPatch.wins = s.wins + (won ? 1 : 0);
    coinPatch.losses = s.losses + (won ? 0 : 1);
  }
  updateSettings(coinPatch);
  const xp = won ? 900 : 400;
  addXp(xp);
  trackStat("matches");
  if (won) trackStat("wins");
  
  const rankBeforeObj = rankFor(before);
  const rankAfterObj = rankFor(after);
  const rankChanged = rankBeforeObj.id !== rankAfterObj.id;
  if (online && rankChanged) {
    hudStore.set({
      rankPopup: {
        mmrBefore: before,
        mmrAfter: after,
        rankBefore: rankBeforeObj.id,
        rankAfter: rankAfterObj.id,
        rankUp: after > before,
      },
    });
  }
  return {
    won,
    mmrBefore: before,
    mmrAfter: after,
    xp,
    coins,
    rankBefore: rankBeforeObj.id,
    rankAfter: rankAfterObj.id,
    rankUp: after > before,
    rankDown: after < before && online,
  };
}

export function recordKill(headshot: boolean, weapon: string) {
  trackStat("kills");
  addXp(headshot ? 120 : 80);
  if (headshot) trackStat("headshots");
  if (weapon === "sniper") trackStat("sniperKills");
  if (weapon === "shotgun" || weapon === "tacshotgun") trackStat("shotgunKills");
  if (weapon === "rocket") trackStat("rocketKills");
}

export function recordRoundWin() {
  trackStat("rounds");
  addXp(150);
}

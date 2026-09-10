/**
 * Ranked scaffolding. The ladder is not open yet — this module already holds
 * the tier table and the rating math so the ranked season can be switched on
 * later without touching the UI again.
 */

export interface Rank {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
}

export const SEASON_ID = "S1";
export const SEASON_NAME_DISPLAY = "SAISON 1 // NEXUS RISING";

export const RANKS: Rank[] = [
  { id: "bronze",   name: "BRONZE",   min: 0,    color: "#c58a55", icon: "🥉" },
  { id: "silber",   name: "SILBER",   min: 900,  color: "#b9c6d6", icon: "🥈" },
  { id: "gold",     name: "GOLD",     min: 1400, color: "#ffd447", icon: "🥇" },
  { id: "platin",   name: "PLATIN",   min: 1900, color: "#6ee7d6", icon: "💎" },
  { id: "diamant",  name: "DIAMANT",  min: 2400, color: "#6ea8ff", icon: "🔷" },
  { id: "elite",    name: "ELITE",    min: 2900, color: "#c86bff", icon: "💜" },
  { id: "champion", name: "CHAMPION", min: 3400, color: "#ff6b35", icon: "🔥" },
];

/** ranked ladder is live */
export const RANKED_OPEN = true;

export function rankFor(mmr: number): Rank {
  let out = RANKS[0]!;
  for (const r of RANKS) if (mmr >= r.min) out = r;
  return out;
}

export function nextRank(mmr: number): Rank | null {
  return RANKS.find((r) => r.min > mmr) ?? null;
}

/** simple elo update, k scales with match length */
export function applyResult(mmr: number, opponentMmr: number, won: boolean, k = 32): number {
  const expected = 1 / (1 + 10 ** ((opponentMmr - mmr) / 400));
  return Math.max(0, Math.round(mmr + k * ((won ? 1 : 0) - expected)));
}

export function progressToNext(mmr: number): number {
  const cur = rankFor(mmr);
  const nxt = nextRank(mmr);
  if (!nxt) return 1;
  return Math.min(1, Math.max(0, (mmr - cur.min) / (nxt.min - cur.min)));
}

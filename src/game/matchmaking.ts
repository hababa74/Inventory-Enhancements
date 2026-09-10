/**
 * Client side of the match server.
 *
 * The server owns pairing, the match record, the score and the rating; the
 * realtime channel only carries the fast per-frame state between the two
 * paired clients.
 */

import { cancelSearch, findMatch, forfeitMatch, matchState, playerStats, reportDeath } from "@/lib/match.functions";
export type { MatchHistoryEntry, PlayerStats } from "@/lib/match.functions";

export interface ServerMatch {
  id: string;
  code: string;
  status: string;
  bestOf: number;
  seed: number;
  youAreHost: boolean;
  you: { name: string; skin: string; score: number; mmr: number; mmrAfter: number | null };
  opponent: { name: string; skin: string; score: number; mmr: number };
  winner: "you" | "opponent" | null;
}

const KEY = "mvm.playerId";

export function playerId(): string {
  if (typeof window === "undefined") return "server-000000";
  let id = localStorage.getItem(KEY);
  if (!id || id.length < 8) {
    id = `p${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** The match this client is currently playing on the server (if any). */
export let activeMatch: ServerMatch | null = null;
export function setActiveMatch(m: ServerMatch | null) {
  activeMatch = m;
}

/** Tracks the cancel function of any currently-running search to prevent parallel loops. */
let activeSearchCancel: (() => void) | null = null;

export type SearchEvent =
  | { type: "searching"; queued: number; seconds: number; mmr: number }
  | { type: "matched"; match: ServerMatch }
  | { type: "error"; message: string };

/**
 * Enter the queue and poll until the server paired us. Returns a cancel fn.
 */
export function searchForMatch(
  name: string,
  skin: string,
  bestOf: number,
  onEvent: (e: SearchEvent) => void,
): () => void {
  const id = playerId();
  let stopped = false;
  let fails = 0;
  const started = Date.now();

  // Cancel any previously running search before starting a new one
  if (activeSearchCancel) {
    activeSearchCancel();
    activeSearchCancel = null;
  }

  const tick = async () => {
    if (stopped) return;
    try {
      const res = await findMatch({ data: { playerId: id, name, skin, bestOf } });
      if (stopped) return;
      fails = 0;
      if (res.status === "matched") {
        setActiveMatch(res.match);
        onEvent({ type: "matched", match: res.match });
        return;
      }
      if (res.status === "error") {
        // the server is busy, not broken — keep the ticket alive and retry
        fails += 1;
        if (fails >= 6) {
          onEvent({ type: "error", message: "Matchsuche gerade überlastet. Bitte kurz erneut versuchen." });
          return;
        }
      } else {
        onEvent({
          type: "searching",
          queued: res.queued,
          seconds: Math.round((Date.now() - started) / 1000),
          mmr: res.mmr,
        });
      }
    } catch {
      if (stopped) return;
      // transient network hiccup: back off, do not drop the player out of the queue
      fails += 1;
      if (fails >= 6) {
        onEvent({ type: "error", message: "Match-Server nicht erreichbar." });
        return;
      }
    }
    if (stopped) return;
    // jitter keeps many clients from hitting the server on the same tick
    const wait = (fails > 0 ? Math.min(4000, 900 * 2 ** (fails - 1)) : 1200) + Math.random() * 400;
    window.setTimeout(() => void tick(), wait);
  };
  void tick();

  const cancel = () => {
    stopped = true;
    activeSearchCancel = null;
    void cancelSearch({ data: { playerId: id } }).catch(() => undefined);
  };
  activeSearchCancel = cancel;
  return cancel;
}

/** Tell the server we died — it awards the round and ends the match. */
export async function serverReportDeath(): Promise<ServerMatch | null> {
  const m = activeMatch;
  if (!m) return null;
  try {
    const res = await reportDeath({ data: { playerId: playerId(), matchId: m.id } });
    if (res.status === "ok") {
      setActiveMatch(res.match);
      return res.match;
    }
  } catch {
    /* keep playing on network hiccups */
  }
  return null;
}

/** Heartbeat + authoritative score refresh. */
export async function refreshMatch(): Promise<ServerMatch | null> {
  const m = activeMatch;
  if (!m) return null;
  try {
    const res = await matchState({ data: { playerId: playerId(), matchId: m.id } });
    if (res.status === "ok") {
      setActiveMatch(res.match);
      return res.match;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Leave a live server match — the opponent gets the win. */
export async function quitServerMatch() {
  const m = activeMatch;
  setActiveMatch(null);
  if (!m || m.status !== "live") return;
  try {
    await forfeitMatch({ data: { playerId: playerId(), matchId: m.id } });
  } catch {
    /* ignore */
  }
}

/** Career stats + recent live duels for the local player. */
export async function loadPlayerStats() {
  return playerStats({ data: { playerId: playerId() } });
}

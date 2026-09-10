/**
 * Match server: matchmaking queue, authoritative match records and rating.
 *
 * Clients never touch the tables directly (RLS is on, no policies, no grants
 * for anon/authenticated). Everything goes through these server functions,
 * which use the service-role client inside the handler.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const playerId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().trim().min(1).max(20);
const skin = z.string().trim().min(1).max(24);

export interface MatchView {
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

type MatchRow = {
  id: string;
  code: string;
  status: string;
  best_of: number;
  seed: number;
  host_player_id: string;
  guest_player_id: string;
  host_name: string;
  guest_name: string;
  host_skin: string;
  guest_skin: string;
  host_mmr: number;
  guest_mmr: number;
  host_mmr_after: number | null;
  guest_mmr_after: number | null;
  score_host: number;
  score_guest: number;
  winner: string | null;
};

function view(m: MatchRow, pid: string): MatchView {
  const host = m.host_player_id === pid;
  return {
    id: m.id,
    code: m.code,
    status: m.status,
    bestOf: m.best_of,
    seed: m.seed,
    youAreHost: host,
    you: {
      name: host ? m.host_name : m.guest_name,
      skin: host ? m.host_skin : m.guest_skin,
      score: host ? m.score_host : m.score_guest,
      mmr: host ? m.host_mmr : m.guest_mmr,
      mmrAfter: host ? m.host_mmr_after : m.guest_mmr_after,
    },
    opponent: {
      name: host ? m.guest_name : m.host_name,
      skin: host ? m.guest_skin : m.host_skin,
      score: host ? m.score_guest : m.score_host,
      mmr: host ? m.guest_mmr : m.host_mmr,
    },
    winner: m.winner ? ((m.winner === "host") === host ? "you" : "opponent") : null,
  };
}

function elo(mmr: number, opp: number, won: boolean, k = 32) {
  const expected = 1 / (1 + 10 ** ((opp - mmr) / 400));
  return Math.max(0, Math.round(mmr + k * ((won ? 1 : 0) - expected)));
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ratingOf(db: Awaited<ReturnType<typeof admin>>, pid: string, nick: string) {
  const { data } = await db.from("player_ratings").select("mmr").eq("player_id", pid).maybeSingle();
  if (data) return (data as { mmr: number }).mmr;
  await db.from("player_ratings").insert({ player_id: pid, name: nick });
  return 1000;
}

/** Join the queue, or return the match once the server paired two players. */
export const findMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId, name, skin, bestOf: z.number().int().min(1).max(9).default(5) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const mmr = await ratingOf(db, data.playerId, data.name);
    const { data: row, error } = await db.rpc("mm_find_or_queue", {
      p_player_id: data.playerId,
      p_name: data.name,
      p_skin: data.skin,
      p_mmr: mmr,
      p_region: "eu",
      p_best_of: data.bestOf,
    });
    if (error) {
      console.error("mm_find_or_queue failed", error.message);
      return { status: "error" as const, message: "Matchsuche nicht verfügbar." };
    }
    const raw = (Array.isArray(row) ? row[0] : row) as MatchRow | null;
    // a plpgsql function returning a composite type answers an unmatched
    // player with a row of NULLs, not with null
    const match = raw && raw.id ? raw : null;
    if (!match) {
      const { count } = await db
        .from("mm_queue")
        .select("player_id", { count: "exact", head: true })
        .is("match_id", null);
      return { status: "searching" as const, queued: count ?? 1, mmr };
    }
    await db.from("mm_queue").delete().eq("player_id", data.playerId);
    return { status: "matched" as const, match: view(match, data.playerId), mmr };
  });

/** Leave the queue. */
export const cancelSearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("mm_queue").delete().eq("player_id", data.playerId).is("match_id", null);
    return { ok: true };
  });

/** Authoritative match state + liveness heartbeat. */
export const matchState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId, matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    const m = row as MatchRow | null;
    if (!m || (m.host_player_id !== data.playerId && m.guest_player_id !== data.playerId)) {
      return { status: "unknown" as const };
    }
    const host = m.host_player_id === data.playerId;
    await db
      .from("matches")
      .update(host ? { host_seen_at: new Date().toISOString() } : { guest_seen_at: new Date().toISOString() })
      .eq("id", m.id);
    return { status: "ok" as const, match: view(m, data.playerId) };
  });

/**
 * A client reports its own death — the server awards the round to the other
 * side. Self-reported losses cannot be abused to gain score.
 */
export const reportDeath = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ playerId, matchId: z.string().uuid(), expectedRound: z.number().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    const m = row as MatchRow | null;
    if (!m || m.status !== "live") return { status: "unknown" as const };
    const host = m.host_player_id === data.playerId;
    const guest = m.guest_player_id === data.playerId;
    if (!host && !guest) return { status: "unknown" as const };

    const currentRound = m.score_host + m.score_guest;
    if (data.expectedRound !== undefined && data.expectedRound !== currentRound) {
      // Duplicate death report for an already processed round; return current match view idempotently
      return { status: "ok" as const, match: view(m, data.playerId) };
    }

    const scoreHost = m.score_host + (guest ? 1 : 0);
    const scoreGuest = m.score_guest + (host ? 1 : 0);
    const need = Math.floor(m.best_of / 2) + 1;
    const done = scoreHost >= need || scoreGuest >= need;
    const hostWon = scoreHost >= need;

    const hostAfter = elo(m.host_mmr, m.guest_mmr, hostWon);
    const guestAfter = elo(m.guest_mmr, m.host_mmr, !hostWon);
    const now = new Date().toISOString();
    const patch = {
      score_host: scoreHost,
      score_guest: scoreGuest,
      updated_at: now,
      ...(done
        ? {
            status: "finished",
            winner: hostWon ? "host" : "guest",
            ended_at: now,
            host_mmr_after: hostAfter,
            guest_mmr_after: guestAfter,
          }
        : {}),
    };
    const { data: updated } = await db.from("matches").update(patch).eq("id", m.id).select("*").maybeSingle();

    if (done) {
      for (const side of [
        { id: m.host_player_id, nick: m.host_name, mmr: hostAfter, won: hostWon },
        { id: m.guest_player_id, nick: m.guest_name, mmr: guestAfter, won: !hostWon },
      ]) {
        const { data: prev } = await db
          .from("player_ratings")
          .select("wins, losses")
          .eq("player_id", side.id)
          .maybeSingle();
        const p = (prev ?? { wins: 0, losses: 0 }) as { wins: number; losses: number };
        await db.from("player_ratings").upsert(
          {
            player_id: side.id,
            name: side.nick,
            mmr: side.mmr,
            wins: p.wins + (side.won ? 1 : 0),
            losses: p.losses + (side.won ? 0 : 1),
            updated_at: now,
          },
          { onConflict: "player_id" },
        );
      }
    }
    return { status: "ok" as const, match: view((updated as MatchRow) ?? { ...m, ...patch }, data.playerId) };
  });


/** Abandon a live match — the opponent takes the win. */
export const forfeitMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId, matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    const m = row as MatchRow | null;
    if (!m || m.status !== "live") return { ok: true };
    const host = m.host_player_id === data.playerId;
    if (!host && m.guest_player_id !== data.playerId) return { ok: true };
    await db
      .from("matches")
      .update({
        status: "finished",
        winner: host ? "guest" : "host",
        ended_at: new Date().toISOString(),
        host_mmr_after: elo(m.host_mmr, m.guest_mmr, !host),
        guest_mmr_after: elo(m.guest_mmr, m.host_mmr, host),
      })
      .eq("id", m.id);
    await db.from("mm_queue").delete().eq("player_id", data.playerId);
    return { ok: true };
  });

/** Public ladder — top rated players on the match server. */
export const leaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("player_ratings")
    .select("name, mmr, wins, losses")
    .order("mmr", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{ name: string; mmr: number; wins: number; losses: number }>;
});

export interface MatchHistoryEntry {
  id: string;
  code: string;
  status: string;
  endedAt: string | null;
  opponent: string;
  opponentSkin: string;
  yourScore: number;
  opponentScore: number;
  result: "win" | "loss" | "live";
  mmrBefore: number;
  mmrAfter: number | null;
  mmrDelta: number | null;
}

export interface PlayerStats {
  mmr: number;
  wins: number;
  losses: number;
  streak: number;
  bestWin: number;
  history: MatchHistoryEntry[];
}

/** Career numbers plus the recent live duels of one player. */
export const playerStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId }).parse(input))
  .handler(async ({ data }): Promise<PlayerStats> => {
    const db = await admin();
    const pid = data.playerId;
    const { data: rating } = await db
      .from("player_ratings")
      .select("mmr, wins, losses")
      .eq("player_id", pid)
      .maybeSingle();
    const r = (rating ?? { mmr: 1000, wins: 0, losses: 0 }) as { mmr: number; wins: number; losses: number };

    const { data: rows } = await db
      .from("matches")
      .select("*")
      .or(`host_player_id.eq.${pid},guest_player_id.eq.${pid}`)
      .in("status", ["live", "finished"])
      .order("created_at", { ascending: false })
      .limit(25);

    const history: MatchHistoryEntry[] = ((rows ?? []) as Array<MatchRow & { ended_at: string | null }>).map((m) => {
      const v = view(m, pid);
      const before = v.you.mmr;
      const after = v.you.mmrAfter;
      return {
        id: v.id,
        code: v.code,
        status: v.status,
        endedAt: m.ended_at,
        opponent: v.opponent.name,
        opponentSkin: v.opponent.skin,
        yourScore: v.you.score,
        opponentScore: v.opponent.score,
        result: m.status === "live" ? "live" : v.winner === "you" ? "win" : "loss",
        mmrBefore: before,
        mmrAfter: after,
        mmrDelta: after === null ? null : after - before,
      };
    });

    let streak = 0;
    for (const h of history) {
      if (h.result === "live") continue;
      if (streak === 0) streak = h.result === "win" ? 1 : -1;
      else if (streak > 0 && h.result === "win") streak += 1;
      else if (streak < 0 && h.result === "loss") streak -= 1;
      else break;
    }
    const bestWin = history.reduce(
      (best, h) => (h.result === "win" && (h.mmrDelta ?? 0) > best ? (h.mmrDelta ?? 0) : best),
      0,
    );

    return { mmr: r.mmr, wins: r.wins, losses: r.losses, streak, bestWin, history };
  });

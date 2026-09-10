import { useEffect, useMemo, useState } from "react";
import {
  MAX_TIER,
  PREMIUM_PRICE,
  SEASON_NAME,
  TIER_REWARDS,
  XP_PER_TIER,
  buyPremium,
  claimTier,
  levelFromXp,
  xpIntoLevel,
} from "../../game/progression";
import { useSettings } from "../../game/store";

const KIND_ICON: Record<string, string> = {
  coins: "◆",
  skin: "☗",
  spray: "✦",
  title: "❏",
  banner: "⌘",
  boost: "▲",
};

export function BattlePassPanel() {
  const xp = useSettings((s) => s.bpXp);
  const claimed = useSettings((s) => s.bpClaimed);
  const premium = useSettings((s) => s.bpPremium);
  const coins = useSettings((s) => s.coins);
  const [msg, setMsg] = useState("");

  const level = levelFromXp(xp);
  const into = xpIntoLevel(xp);
  const claimable = useMemo(
    () => TIER_REWARDS.filter((r, i) => i + 1 <= level && !claimed.includes(i + 1) && (!r.premium || premium)).length,
    [level, claimed, premium],
  );

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="clip-chamfer border border-[color:var(--neon)]/30 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-title text-[11px] tracking-[0.3em] text-[color:var(--neon)]">{SEASON_NAME}</div>
            <div className="font-title text-2xl font-black">
              STUFE {level} <span className="text-sm text-muted-foreground">/ {MAX_TIER}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest text-muted-foreground">FORTSCHRITT</div>
            <div className="font-title text-lg">
              {into} / {XP_PER_TIER} XP
            </div>
          </div>
          {premium ? (
            <span className="clip-chamfer border border-[color:var(--neon-2)]/60 px-3 py-1.5 font-title text-[11px] tracking-widest text-[color:var(--neon-2)]">
              PREMIUM AKTIV
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMsg(buyPremium())}
              className={`clip-chamfer border px-3 py-2 font-title text-[11px] tracking-widest transition ${
                coins >= PREMIUM_PRICE
                  ? "border-[color:var(--neon)] text-[color:var(--neon)] hover:bg-[color:var(--neon)]/10"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              PREMIUM-PASS ◆ {PREMIUM_PRICE.toLocaleString("de-DE")}
            </button>
          )}
        </div>
        <div className="mt-3 h-2 w-full bg-black/60">
          <div
            className="h-full bg-[color:var(--neon)] shadow-[0_0_12px_var(--neon)]"
            style={{ width: `${Math.round((into / XP_PER_TIER) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] tracking-widest text-muted-foreground">
          <span>{premium ? "+25% XP DURCH PREMIUM" : "XP DURCH KILLS, RUNDEN & CHALLENGES"}</span>
          <span className={claimable ? "text-[color:var(--neon-2)]" : ""}>
            {claimable ? `${claimable} BELOHNUNG(EN) ABHOLBEREIT` : "KEINE OFFENEN BELOHNUNGEN"}
          </span>
        </div>
        {msg && <p className="mt-2 text-sm text-[color:var(--neon-2)]">{msg}</p>}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {TIER_REWARDS.map((r, i) => {
            const lvl = i + 1;
            const unlocked = lvl <= level;
            const got = claimed.includes(lvl);
            const blocked = r.premium && !premium;
            const ready = unlocked && !got && !blocked;
            return (
              <button
                key={lvl}
                type="button"
                disabled={!ready}
                onClick={() => setMsg(claimTier(lvl))}
                className={`clip-chamfer border p-2 text-left transition ${
                  ready
                    ? "border-[color:var(--neon)] bg-[color:var(--neon)]/10 hover:bg-[color:var(--neon)]/20"
                    : got
                      ? "border-[color:var(--neon-2)]/50 bg-black/40"
                      : "border-border/50 bg-black/30 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] tracking-widest">
                  <span className="font-title">STUFE {lvl}</span>
                  {r.premium && (
                    <span className="text-[color:var(--danger)]">PREMIUM</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-title text-lg text-[color:var(--neon)]">{KIND_ICON[r.kind] ?? "◆"}</span>
                  <span className="text-xs leading-tight">{r.label}</span>
                </div>
                <div className="mt-2 text-[10px] tracking-widest text-muted-foreground">
                  {got ? "ABGEHOLT ✓" : ready ? "ABHOLEN" : blocked ? "GESPERRT" : `AB ${(lvl - 1) * XP_PER_TIER} XP`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

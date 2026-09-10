import { useEffect, useState } from "react";
import {
  claimChallenge,
  dailyChallenges,
  ensureDailyFresh,
  msUntilReset,
} from "../../game/progression";
import { useSettings } from "../../game/store";

function fmt(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}h`;
}

/** Today's three challenges with live progress and reward claiming. */
export function DailyChallenges({ compact = false }: { compact?: boolean }) {
  const date = useSettings((s) => s.dailyDate);
  const progress = useSettings((s) => s.dailyProgress);
  const claimedIds = useSettings((s) => s.dailyClaimed);
  const [left, setLeft] = useState(msUntilReset());
  const [msg, setMsg] = useState("");

  useEffect(() => {
    ensureDailyFresh();
    const t = setInterval(() => {
      setLeft(msUntilReset());
      ensureDailyFresh();
    }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  const list = dailyChallenges(date || undefined);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-title text-[11px] tracking-widest text-[color:var(--danger)]">
          ● TAGES-HERAUSFORDERUNGEN
        </span>
        <span className="text-[10px] text-muted-foreground">{fmt(left)}</span>
      </div>
      {msg && <p className="mt-2 text-xs text-[color:var(--neon-2)]">{msg}</p>}
      <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-3"}>
        {list.map((c) => {
          const cur = progress[c.id] ?? 0;
          const done = cur >= c.goal;
          const got = claimedIds.includes(c.id);
          const pct = Math.round((Math.min(cur, c.goal) / c.goal) * 100);
          return (
            <div
              key={c.id}
              className={`border-l-2 bg-black/35 p-3 ${done ? "border-[color:var(--neon-2)]" : "border-[color:var(--neon)]"}`}
            >
              <div className="flex justify-between gap-2 text-sm">
                <span>{c.text}</span>
                <span className={done ? "text-[color:var(--neon-2)]" : "text-[color:var(--neon)]"}>
                  {Math.min(cur, c.goal)} / {c.goal}
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-black/60">
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, background: done ? "var(--neon-2)" : "var(--neon)" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] tracking-widest text-muted-foreground">
                  +{c.xp.toLocaleString("de-DE")} XP · {c.coins} COINS
                </span>
                {got ? (
                  <span className="text-[10px] tracking-widest text-[color:var(--neon-2)]">ABGEHOLT ✓</span>
                ) : (
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => setMsg(claimChallenge(c.id))}
                    className={`clip-chamfer border px-2 py-1 font-title text-[10px] tracking-widest transition ${
                      done
                        ? "border-[color:var(--neon)] text-[color:var(--neon)] hover:bg-[color:var(--neon)]/10"
                        : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {done ? "ABHOLEN" : "LÄUFT"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

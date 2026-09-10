import { useCallback, useEffect, useState } from "react";
import { loadPlayerStats, type PlayerStats } from "../../game/matchmaking";

function Stat({ label, value, color }: { label: string; value: string; color?: string | undefined }) {
  return (
    <div className="clip-chamfer border border-border/60 p-3 text-center">
      <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-title text-lg" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function when(iso: string | null) {
  if (!iso) return "LÄUFT";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MatchStats() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await loadPlayerStats());
      setError("");
    } catch {
      setError("Statistik konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const played = (stats?.wins ?? 0) + (stats?.losses ?? 0);
  const rate = played > 0 ? Math.round(((stats?.wins ?? 0) / played) * 100) : 0;
  const streak = stats?.streak ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-title text-[11px] tracking-[0.3em] text-[color:var(--neon)]">
          ● LIVE-DUELLE
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="clip-chamfer border border-[color:var(--neon)]/30 px-3 py-1 font-title text-[10px] tracking-widest hover:border-[color:var(--neon)]"
        >
          {loading ? "LÄDT…" : "AKTUALISIEREN"}
        </button>
      </div>

      {error && (
        <div className="clip-chamfer border border-[color:var(--danger)]/50 p-3 text-[11px] text-[color:var(--danger)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="GEWONNEN" value={String(stats?.wins ?? 0)} color="var(--neon-2)" />
        <Stat label="VERLOREN" value={String(stats?.losses ?? 0)} color="var(--danger)" />
        <Stat label="SIEGQUOTE" value={`${rate}%`} />
        <Stat label="WERTUNG" value={String(stats?.mmr ?? 1000)} />
        <Stat
          label="SERIE"
          value={streak === 0 ? "—" : streak > 0 ? `${streak} SIEGE` : `${-streak} PLEITEN`}
          color={streak > 0 ? "var(--neon-2)" : streak < 0 ? "var(--danger)" : undefined}
        />
      </div>

      <div className="clip-chamfer border border-border/60">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-border/50 px-3 py-2 font-title text-[10px] tracking-widest text-muted-foreground">
          <span>GEGNER</span>
          <span className="text-center">SCORE</span>
          <span className="text-center">ELO</span>
          <span className="text-right">ZEIT</span>
        </div>
        {(stats?.history.length ?? 0) === 0 && (
          <div className="p-4 text-[11px] text-muted-foreground">
            Noch keine Live-Duelle gespielt. Starte „LIVE-MATCH SUCHEN“, um deine Bilanz aufzubauen.
          </div>
        )}
        {stats?.history.map((h) => {
          const live = h.result === "live";
          const win = h.result === "win";
          const color = live ? "var(--neon)" : win ? "var(--neon-2)" : "var(--danger)";
          return (
            <div
              key={h.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/25 px-3 py-2 text-[11px] last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="truncate">{h.opponent}</span>
                <span className="hidden shrink-0 font-title text-[9px] tracking-widest text-muted-foreground sm:inline">
                  #{h.code}
                </span>
              </span>
              <span className="text-center font-title" style={{ color }}>
                {h.yourScore} : {h.opponentScore}
              </span>
              <span className="w-16 text-center font-title" style={{ color: (h.mmrDelta ?? 0) >= 0 ? "var(--neon-2)" : "var(--danger)" }}>
                {h.mmrDelta === null ? "—" : `${h.mmrDelta > 0 ? "+" : ""}${h.mmrDelta}`}
              </span>
              <span className="text-right text-muted-foreground">{when(h.endedAt)}</span>
            </div>
          );
        })}
      </div>

      <div className="clip-chamfer border border-border/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
        Matches: {played} · Bester Elo-Gewinn: +{stats?.bestWin ?? 0} · Die Werte kommen direkt vom Match-Server und
        aktualisieren sich alle 15 Sekunden.
      </div>
    </div>
  );
}

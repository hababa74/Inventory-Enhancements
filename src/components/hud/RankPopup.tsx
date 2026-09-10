import { useEffect, useRef } from "react";
import { useHud, hudStore } from "../../game/store";
import { rankFor, RANKS } from "../../game/ranks";

export function RankPopup() {
  const popup = useHud((s) => s.rankPopup);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!popup) return;
    // Auto-dismiss after 5 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      hudStore.set({ rankPopup: null });
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [popup]);

  if (!popup) return null;

  const before = rankFor(popup.mmrBefore);
  const after = rankFor(popup.mmrAfter);
  const mmrDelta = popup.mmrAfter - popup.mmrBefore;
  const isUp = popup.rankUp;
  const rankChanged = before.id !== after.id;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/3 z-50 -translate-x-1/2 -translate-y-1/2"
      style={{ animation: "rank-popup-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-lg border-2 px-10 py-6 text-center backdrop-blur-sm"
        style={{
          borderColor: isUp ? "#3dff9e" : "#ff4d6d",
          background: isUp ? "rgba(0,40,20,0.85)" : "rgba(40,0,10,0.85)",
          boxShadow: isUp
            ? "0 0 40px rgba(61,255,158,0.35), 0 0 80px rgba(61,255,158,0.15)"
            : "0 0 40px rgba(255,77,109,0.35), 0 0 80px rgba(255,77,109,0.15)",
        }}
      >
        {/* Header */}
        <div
          className="font-display text-[11px] font-black tracking-[0.4em]"
          style={{ color: isUp ? "#3dff9e" : "#ff4d6d" }}
        >
          {rankChanged ? (isUp ? "⬆ RANG AUFGESTIEGEN" : "⬇ RANG ABGESTIEGEN") : "BEWERTUNGSÄNDERUNG"}
        </div>

        {/* Rank display */}
        {rankChanged ? (
          <div className="flex items-center gap-4">
            {/* Before */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl" style={{ filter: "grayscale(0.4)" }}>{before.icon}</span>
              <span className="font-display text-xs font-bold" style={{ color: before.color }}>{before.name}</span>
            </div>
            {/* Arrow */}
            <div className="font-display text-2xl font-black" style={{ color: isUp ? "#3dff9e" : "#ff4d6d" }}>
              {isUp ? "→" : "→"}
            </div>
            {/* After */}
            <div
              className="flex flex-col items-center gap-1"
              style={{ animation: "rank-badge-pulse 0.6s ease-out 0.4s both" }}
            >
              <span className="text-4xl">{after.icon}</span>
              <span className="font-display text-sm font-bold" style={{ color: after.color }}>{after.name}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl">{after.icon}</span>
            <span className="font-display text-lg font-bold" style={{ color: after.color }}>{after.name}</span>
          </div>
        )}

        {/* MMR change */}
        <div
          className="font-display text-2xl font-black tabular-nums"
          style={{ color: mmrDelta >= 0 ? "#3dff9e" : "#ff4d6d" }}
        >
          {mmrDelta >= 0 ? "+" : ""}{mmrDelta} MMR
        </div>

        {/* New MMR total */}
        <div className="text-xs tracking-widest text-muted-foreground">
          {popup.mmrAfter} MMR gesamt
        </div>
      </div>
    </div>
  );
}

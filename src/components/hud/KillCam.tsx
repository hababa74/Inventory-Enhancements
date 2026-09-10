import { useEffect, useRef, useState } from "react";
import { useHud, hudStore } from "../../game/store";
import type { ReplayFrame } from "../../game/store";

export function KillCam() {
  const active = useHud((s) => s.killCamActive);
  const frames = useHud((s) => s.killCamFrames);
  const duration = useHud((s) => s.killCamDuration);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active || !frames?.length) return;
    setFrameIndex(0);
    setPlaying(true);
    setCountdown(5);
    doneRef.current = false;
    startTimeRef.current = performance.now();

    const playbackSpeed = 0.3;
    const totalPlaybackMs = (duration / playbackSpeed) * 1000;

    const tick = () => {
      if (doneRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(1, elapsed / totalPlaybackMs);
      const idx = Math.floor(progress * (frames.length - 1));
      setFrameIndex(idx);

      if (progress >= 1) {
        setPlaying(false);
        // Start countdown
        let cd = 5;
        setCountdown(cd);
        const interval = setInterval(() => {
          cd -= 1;
          setCountdown(cd);
          if (cd <= 0) {
            clearInterval(interval);
            if (!doneRef.current) {
              doneRef.current = true;
              hudStore.set({ killCamActive: false, killCamFrames: null });
            }
          }
        }, 1000);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, frames, duration]);

  if (!active || !frames?.length) return null;
  const frame = frames[frameIndex] ?? frames[frames.length - 1]!;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }}>
      {/* Kill Cam Banner */}
      <div className="absolute left-1/2 top-6 -translate-x-1/2">
        <div
          className="panel px-6 py-2 text-center"
          style={{ animation: "rank-popup-in 0.3s ease-out both" }}
        >
          <div className="font-display text-xs font-black tracking-[0.4em] text-[color:var(--danger)]">KILL CAM</div>
          <div className="mt-0.5 text-[10px] tracking-widest text-muted-foreground">
            {playing ? `0.3× GESCHWINDIGKEIT` : `WEITER IN ${countdown}s`}
          </div>
        </div>
      </div>

      {/* Replay info overlay */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center">
        <div className="panel px-4 py-2 text-sm">
          <div className="text-xs text-muted-foreground mb-1">GEGNER</div>
          <div className="flex gap-6 text-xs">
            <span>HP: <span className="font-bold text-[color:var(--danger)]">{Math.round(frame.bHp)}</span></span>
            <span>Du: <span className="font-bold text-[color:var(--neon)]">{Math.round(frame.pHp)}</span> HP</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {playing && (
        <div className="absolute bottom-16 left-1/2 w-64 -translate-x-1/2">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-[color:var(--danger)] transition-none"
              style={{ width: `${(frameIndex / Math.max(1, frames.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Skip button */}
      <button
        type="button"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded border border-border/60 px-6 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          doneRef.current = true;
          cancelAnimationFrame(rafRef.current);
          hudStore.set({ killCamActive: false, killCamFrames: null });
        }}
      >
        ÜBERSPRINGEN
      </button>
    </div>
  );
}

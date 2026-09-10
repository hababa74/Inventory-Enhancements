import { useEffect, useRef, useState } from "react";

function isCoarse() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

function isPortrait() {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth;
}

/** Asks touch users to go fullscreen + landscape before playing. */
export function MobileFullscreenPrompt() {
  const [show, setShow] = useState(false);
  const dismissed = useRef(false);

  useEffect(() => {
    if (!isCoarse()) return;

    const evaluate = () => {
      if (dismissed.current) {
        setShow(false);
        return;
      }
      const fs = !!document.fullscreenElement;
      setShow(!fs || isPortrait());
    };

    evaluate();
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);
    document.addEventListener("fullscreenchange", evaluate);
    return () => {
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
      document.removeEventListener("fullscreenchange", evaluate);
    };
  }, []);

  if (!show) return null;

  const go = async () => {
    // Close immediately – some browsers (iOS Safari, sandboxed iframes) silently
    // reject fullscreen/orientation requests, the popup must never get stuck.
    dismissed.current = true;
    setShow(false);
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
        else await el.webkitRequestFullscreen?.();
      }
    } catch {
      /* ignore */
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation?.lock?.("landscape");
    } catch {
      /* rotation lock not supported – user rotates manually */
    }
  };


  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 px-6 backdrop-blur-md">
      <div className="panel w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-24 items-center justify-center rounded-lg border-2 border-[color:var(--neon)]/60">
          <span className="text-2xl">⟳</span>
        </div>
        <h2 className="font-display text-xl font-bold neon-text">QUERFORMAT AKTIVIEREN</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Für die beste Steuerung startet das Spiel im Vollbild und im Querformat.
        </p>
        <button
          type="button"
          onClick={go}
          className="mt-5 w-full rounded-md border border-[color:var(--neon)] bg-[color:var(--neon)]/15 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--neon)]"
        >
          Vollbild starten
        </button>
        <button
          type="button"
          onClick={() => {
            dismissed.current = true;
            setShow(false);
          }}

          className="mt-3 w-full px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
        >
          Trotzdem fortfahren
        </button>
      </div>
    </div>
  );
}

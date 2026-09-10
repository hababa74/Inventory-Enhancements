import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GameCanvas } from "../components/game/GameCanvas";
import { Hud } from "../components/hud/Hud";
import { MainMenu, type StartOptions } from "../components/hud/MainMenu";
import { EndScreen, NeonButton, RoundBanner, SettingsPanel } from "../components/hud/Menus";
import { TouchControls } from "../components/hud/TouchControls";
import { MobileFullscreenPrompt } from "../components/hud/MobileFullscreenPrompt";
import { KillCam } from "../components/hud/KillCam";

import { engine } from "../game/engine";
import { hudStore, hydrateSettings, settingsStore, useHud } from "../game/store";
import { audioSettings, applyVolumes, initAudio, startMusic, stopMusic } from "../game/audio";
import { releaseLock, requestLock } from "../game/input";
import { connection } from "../game/net";
import { activeMatch, quitServerMatch, refreshMatch, serverReportDeath } from "../game/matchmaking";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mann-vs-Mann — 1v1 Build & Shoot Arena im Browser" },
      {
        name: "description",
        content:
          "Mann-vs-Mann ist ein schneller 1v1-Arena-Shooter mit Bausystem, Instant-Edits, fünf Waffen und flüssigem Movement — direkt im Browser spielbar.",
      },
      { property: "og:title", content: "Mann-vs-Mann — 1v1 Build & Shoot Arena" },
      {
        property: "og:description",
        content: "Bauen, editieren, zielen, gewinnen: kompetitives 1v1 im Browser mit 3D-Grafik und Bot-Gegner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const screen = useHud((s) => s.screen);
  const killCamActive = useHud((s) => s.killCamActive);
  const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const [booted, setBooted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [autoRoom, setAutoRoom] = useState<string | null>(null);

  useEffect(() => {
    hydrateSettings();
    const s = settingsStore.get();
    audioSettings.master = s.master;
    audioSettings.sfx = s.sfx;
    audioSettings.music = s.music;
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setWebglError(true);
    } catch {
      setWebglError(true);
    }
    const room = new URLSearchParams(window.location.search).get("room");
    if (room) setAutoRoom(room.toUpperCase());
    setBooted(true);
  }, []);

  // route incoming realtime messages into the engine
  useEffect(() => {
    return connection.on((e) => {
      if (e.type === "msg") engine.applyNetMessage(e.data);
      else if (e.type === "opponentLeft") {
        engine.online = false;
        hudStore.set({ connection: "lost" });
      }
    });
  }, []);

  const startMatch = useCallback((o: StartOptions) => {
    initAudio();
    applyVolumes();
    startMusic();
    engine.online = o.online;
    engine.isHost = o.isHost;
    engine.netSend = o.online ? (m) => connection.send(m) : null;
    // on the match server the loss of a round is reported by the player who
    // died — the server owns score, match end and rating
    engine.onLocalDeath = o.online && activeMatch ? () => void serverReportDeath() : null;
    hudStore.set({
      screen: "playing",
      opponentName: o.opponent,
      opponentSkin: o.opponentSkin,
      roomCode: o.roomCode,
      connection: o.online ? "connected" : "local",
    });
    engine.setLoadout(settingsStore.get().loadout);
    engine.startMatch(settingsStore.get().bestOf, o.gameMode ?? "duel");

    setTimeout(() => requestLock(), 120);
  }, []);

  const leaveMatch = useCallback(() => {
    releaseLock();
    stopMusic();
    engine.online = false;
    engine.netSend = null;
    engine.onLocalDeath = null;
    void quitServerMatch();
    connection.leave();
    engine.state = "idle";
    hudStore.set({ screen: "menu", roundResult: null, matchResult: null });
  }, []);

  // keep the authoritative match state in sync while playing
  useEffect(() => {
    if (screen !== "playing") return;
    const id = window.setInterval(() => {
      if (activeMatch) void refreshMatch();
    }, 5000);
    return () => window.clearInterval(id);
  }, [screen]);

  // ESC / pointer-lock loss pauses the match
  useEffect(() => {
    const onLockChange = () => {
      const cur = hudStore.get().screen;
      if (!document.pointerLockElement && cur === "playing" && engine.state !== "matchEnd") {
        hudStore.set({ screen: "paused" });
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () => document.removeEventListener("pointerlockchange", onLockChange);
  }, []);

  // match end releases the cursor
  useEffect(() => {
    if (screen === "matchEnd") releaseLock();
  }, [screen]);

  const inGame = screen !== "menu";

  if (!booted) {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold neon-text">MANN-VS-MANN</h1>
          <p className="mt-2 text-sm tracking-widest text-muted-foreground">LADE ARENA…</p>
        </div>
      </main>
    );
  }

  if (webglError) {
    return (
      <main className="flex h-screen items-center justify-center bg-background px-6">
        <div className="panel max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-[color:var(--danger)]">3D nicht verfügbar</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Dein Browser meldet keine WebGL-Unterstützung. Aktiviere Hardwarebeschleunigung oder nutze aktuelles
            Chrome, Edge oder Firefox.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      <h1 className="sr-only">Mann-vs-Mann — 1v1 Build and Shoot Arena Shooter</h1>
      <MobileFullscreenPrompt />


      {inGame && (
        <>
          <GameCanvas />
          <Hud />
          {killCamActive && <KillCam />}
          <TouchControls />
          {screen === "roundEnd" && <RoundBanner />}

          {/* click-to-lock overlay */}
          {screen === "playing" && !isTouch && (
            <button
              type="button"
              aria-label="Maussteuerung aktivieren"
              className="absolute inset-0 z-10 cursor-crosshair"
              style={{ pointerEvents: document.pointerLockElement ? "none" : "auto" }}
              onClick={() => {
                initAudio();
                requestLock();
              }}
            />
          )}
        </>
      )}

      {screen === "menu" && <MainMenu onStart={startMatch} autoRoom={autoRoom} />}

      {screen === "paused" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (
            <div className="panel w-[380px] max-w-[92vw] p-7">
              <h2 className="font-display text-3xl font-bold neon-text">PAUSE</h2>
              <div className="mt-6 space-y-3">
                <NeonButton
                  onClick={() => {
                    hudStore.set({ screen: "playing" });
                    requestLock();
                  }}
                >
                  Resume
                </NeonButton>
                <NeonButton variant="ghost" onClick={() => setShowSettings(true)}>
                  Settings
                </NeonButton>
                <NeonButton variant="danger" onClick={leaveMatch}>
                  Match verlassen
                </NeonButton>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === "matchEnd" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <EndScreen
            summary={engine.lastSummary}

            onRematch={() => {
              engine.startMatch(settingsStore.get().bestOf);
              hudStore.set({ screen: "playing", matchResult: null, roundResult: null });
              setTimeout(() => requestLock(), 100);
            }}
            onMenu={leaveMatch}
          />
        </div>
      )}
    </main>
  );
}

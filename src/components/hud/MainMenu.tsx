import { useEffect, useRef, useState } from "react";
import { NeonButton, SettingsPanel } from "./Menus";
import { LobbyScene } from "./LobbyScene";
import { connection, roomLink, type NetEvent } from "../../game/net";
import { quitServerMatch, searchForMatch, setActiveMatch, type SearchEvent, type ServerMatch } from "../../game/matchmaking";
import { getSkin, SKINS } from "../../game/skins";
import { RARITY_COLOR, SkinPortrait } from "./SkinPortrait";
import { WeaponIcon } from "./WeaponIcon";

import { RANKS, RANKED_OPEN, nextRank, progressToNext, rankFor } from "../../game/ranks";
import {
  MATCH_STAKE,
  MAX_TIER,
  WEEKLY_COINS,
  WIN_BONUS,
  XP_PER_TIER,
  claimWeekly,
  levelFromXp,
  rewardFor,
  weeklyReady,
  xpIntoLevel,
} from "../../game/progression";
import { BattlePassPanel } from "./BattlePass";
import { DailyChallenges } from "./DailyChallenges";
import MatchStats from "./MatchStats";
import { updateSettings, useSettings } from "../../game/store";
import { useIsMobile } from "../../hooks/use-mobile";
import { MAPS } from "../../game/arena";
import { LOADOUT_SLOTS, WEAPONS, WEAPON_ORDER, GAME_MODES, type GameMode, type WeaponId } from "../../game/constants";
import { GameModeModal } from "./GameModeModal";


type View = "main" | "settings" | "join" | "room" | "howto" | "loadout" | "queue";

export interface StartOptions {
  opponent: string;
  opponentSkin: string;
  roomCode: string;
  online: boolean;
  isHost: boolean;
  gameMode?: GameMode;
}

const NAV_TABS = [
  { id: "SPIELEN", label: "SPIELEN" },
  { id: "SPIND & SKINS", label: "SPIND" },
  { id: "SHOP", label: "SHOP" },
  { id: "BATTLE PASS", label: "BATTLE PASS" },
  { id: "RANGLISTE", label: "RANGLISTE" },
  { id: "STATISTIK", label: "STATISTIK" },
] as const;

function Chamfer({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`hud-card clip-chamfer ${className}`}>{children}</div>;
}

const TONES: Record<string, string> = {
  gold: "from-[oklch(0.88_0.17_85)] to-[oklch(0.78_0.19_60)] text-black",
  violet: "from-[oklch(0.55_0.22_300)] to-[oklch(0.4_0.2_275)] text-white",
  blue: "from-[oklch(0.55_0.21_265)] to-[oklch(0.42_0.19_255)] text-white",
};

function SlantButton({
  onClick,
  icon,
  label,
  tone = "blue",
  badge,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  tone?: "gold" | "violet" | "blue";
  badge?: string;
}) {
  return (
    <div className="relative -skew-x-6">
      {badge && (
        <span className="absolute -top-2 left-2 z-10 skew-x-6 bg-[color:var(--danger)] px-1.5 py-0.5 font-title text-[9px] font-black tracking-widest text-white">
          {badge}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`w-full border-b-4 border-black/40 bg-gradient-to-b ${TONES[tone]} px-4 py-3 text-center shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-0.5`}
      >
        <span className="block skew-x-6">
          <span className="block text-lg leading-none">{icon}</span>
          <span className="mt-1 block font-title text-sm font-black tracking-widest">{label}</span>
        </span>
      </button>
    </div>
  );
}


const BOT_LEVELS = [
  { level: 1, name: "LEICHT" },
  { level: 2, name: "NORMAL" },
  { level: 3, name: "STARK" },
  { level: 4, name: "PROFI" },
  { level: 5, name: "ALBTRAUM" },
];

export function MainMenu({
  onStart,
  autoRoom,
}: {
  onStart: (o: StartOptions) => void;
  autoRoom?: string | null;
}) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("main");
  const [tab, setTab] = useState<string>("SPIELEN");
  const [code, setCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState("");
  const [opponent, setOpponent] = useState<{ name: string; skin: string } | null>(null);
  const [opponentReady, setOpponentReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<"solo" | "ready" | "quick" | null>(null);
  const [queueInfo, setQueueInfo] = useState<{ seconds: number; queued: number } | null>(null);
  const cancelQueueRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const savedGameMode = useSettings((s) => s.gameMode);
  const [selectedMode, setSelectedMode] = useState<GameMode>(savedGameMode ?? "duel");
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [playMode, setPlayMode] = useState<"online" | "bot">("online");

  const bestOf = useSettings((s) => s.bestOf);
  const botLevel = useSettings((s) => s.botLevel);
  const botCount = useSettings((s) => s.botCount);
  const skinId = useSettings((s) => s.skin);
  const mapId = useSettings((s) => s.mapId);
  const playerName = useSettings((s) => s.playerName);
  const loadout = useSettings((s) => s.loadout);
  const owned = useSettings((s) => s.owned);
  const coins = useSettings((s) => s.coins);
  const mmr = useSettings((s) => s.mmr);
  const wins = useSettings((s) => s.wins);
  const losses = useSettings((s) => s.losses);
  const bpXp = useSettings((s) => s.bpXp);
  const bpLevel = levelFromXp(bpXp);
  const unlimitedMats = useSettings((s) => s.unlimitedMats);

  const [shopMsg, setShopMsg] = useState("");

  const isOwned = (id: string) => owned.includes(id) || (SKINS.find((s) => s.id === id)?.price ?? 0) === 0;
  const equipSkin = (id: string) => {
    if (!isOwned(id)) return;
    updateSettings({ skin: id });
    setShopMsg("");
  };
  const buySkin = (id: string) => {
    const s = SKINS.find((x) => x.id === id);
    if (!s || isOwned(id)) return;
    if (coins < s.price) {
      setShopMsg(`Nicht genug Coins für ${s.name} — es fehlen ${s.price - coins}.`);
      return;
    }
    updateSettings({ coins: coins - s.price, owned: [...owned, id], skin: id });
    setShopMsg(`${s.name} gekauft und ausgerüstet.`);
  };

  const toggleWeapon = (id: WeaponId) => {
    const cur = loadout.filter((w) => WEAPONS[w]);
    if (cur.includes(id)) updateSettings({ loadout: cur.filter((w) => w !== id) });
    else if (cur.length < LOADOUT_SLOTS) updateSettings({ loadout: [...cur, id] });
  };
  const fillLoadout = () => {
    const cur = loadout.filter((w) => WEAPONS[w]);
    if (cur.length >= LOADOUT_SLOTS) return cur.slice(0, LOADOUT_SLOTS);
    const pool = WEAPON_ORDER.filter((w) => !cur.includes(w));
    const picked = [...cur];
    while (picked.length < LOADOUT_SLOTS && pool.length)
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    updateSettings({ loadout: picked });
    return picked;
  };
  const openLoadout = (what: "solo" | "ready" | "quick") => {
    setPending(what);
    setView("loadout");
  };
  const confirmLoadout = () => {
    fillLoadout();
    const what = pending;
    setPending(null);
    if (what === "solo") {
      onStart({ opponent: "NOVA-BOT", opponentSkin: "ogmodel", roomCode: "TRAINING", online: false, isHost: true, gameMode: selectedMode });
      return;
    }
    if (what === "quick") {
      startQuickplay();
      return;
    }
    if (what === "ready") {
      setReady(true);
      connection.setReady(true);
      setView("room");
      return;
    }
    setView("main");
  };
  const startQuickplay = () => {
    setError("");
    setQueueInfo({ seconds: 0, queued: 1 });
    setView("queue");
    cancelQueueRef.current?.();
    cancelQueueRef.current = searchForMatch(displayName, skinId, bestOf, (e: SearchEvent) => {
      if (e.type === "searching") {
        setQueueInfo({ seconds: e.seconds, queued: e.queued });
      } else if (e.type === "error") {
        setError(e.message);
        setView("main");
      } else {
        void enterServerMatch(e.match);
      }
    });
  };

  const enterServerMatch = async (match: ServerMatch) => {
    cancelQueueRef.current = null;
    // the realtime channel can drop a first subscribe under load — retry
    // before giving the match up
    let connected = false;
    for (let attempt = 0; attempt < 3 && !connected; attempt++) {
      try {
        await connection.enterMatch(match.code, match.youAreHost, displayName, skinId);
        connected = true;
      } catch (err) {
        console.error("enterMatch failed", err);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (!connected) {
      void quitServerMatch();
      setError("Verbindung zum Match fehlgeschlagen.");
      setView("main");
      return;
    }
    setView("main");
    setQueueInfo(null);
    startRef.current({
      opponent: match.opponent.name,
      opponentSkin: match.opponent.skin,
      roomCode: match.code,
      online: true,
      isHost: match.youAreHost,
    });
  };

  const stopQueue = () => {
    cancelQueueRef.current?.();
    cancelQueueRef.current = null;
    setActiveMatch(null);
    setQueueInfo(null);
    setView("main");
  };

  const randomize = () => {
    const pool = [...WEAPON_ORDER];
    const picked: WeaponId[] = [];
    while (picked.length < LOADOUT_SLOTS) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    updateSettings({ loadout: picked });
  };
  const skin = getSkin(skinId);
  const displayName = playerName.trim() || "PLAYER";

  const startRef = useRef(onStart);
  startRef.current = onStart;
  const oppRef = useRef(opponent);
  oppRef.current = opponent;

  useEffect(() => {
    return connection.on((e: NetEvent) => {
      if (e.type === "connected") {
        setRoomCode(e.roomCode);
        setStatus(e.you === 0 ? "Room offen — teile den Link" : "Room beigetreten");
      } else if (e.type === "opponentJoined") {
        setOpponent({ name: e.name, skin: e.skin });
        setStatus(`${e.name} ist beigetreten`);
      } else if (e.type === "opponentReady") {
        setOpponentReady(e.ready);
      } else if (e.type === "opponentLeft") {
        setOpponent(null);
        setOpponentReady(false);
        setReady(false);
        setStatus("Gegner hat den Room verlassen");
      } else if (e.type === "start") {
        const o = oppRef.current;
        startRef.current({
          opponent: o?.name ?? "GEGNER",
          opponentSkin: o?.skin ?? "cyberblade",
          roomCode: connection.roomCode,
          online: true,
          isHost: connection.isHost,
        });
      } else if (e.type === "error") {
        setError(e.message);
      } else if (e.type === "lost") {
        setError("Verbindung verloren.");
      }
    });
  }, []);

  const resetRoomState = () => {
    setError("");
    setOpponent(null);
    setOpponentReady(false);
    setReady(false);
    setCopied(false);
  };

  const createRoom = async () => {
    resetRoomState();
    setBusy(true);
    setView("room");
    setStatus("Room wird erstellt…");
    try {
      await connection.create(displayName, skinId);
    } catch {
      setError("Room konnte nicht erstellt werden.");
      setView("main");
    }
    setBusy(false);
  };

  const joinRoom = async (raw?: string) => {
    resetRoomState();
    setBusy(true);
    setStatus("Trete Room bei…");
    try {
      await connection.join(raw ?? code, displayName, skinId);
      setView("room");
    } catch {
      /* error already emitted */
    }
    setBusy(false);
  };

  // auto-join when opened through a shared link
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoRoom && !autoDone.current) {
      autoDone.current = true;
      setCode(autoRoom);
      void joinRoom(autoRoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoom]);

  // SPACE starts the solo match from the lobby
  useEffect(() => {
    if (view !== "main") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        openLoadout("solo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink(roomCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Kopieren nicht möglich — Link manuell markieren.");
    }
  };

  const equipped = (loadout.length ? loadout : (["rifle", "shotgun", "sniper"] as WeaponId[]))
    .filter((w) => WEAPONS[w])
    .slice(0, LOADOUT_SLOTS);

  const overlay = view !== "main";
  const playing = tab === "SPIELEN";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#04070f] font-body">
      <LobbyScene skin={skin} weaponId={equipped[0]} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_35%,oklch(0.05_0.02_260/0.75)_90%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(oklch(0.85_0.16_200/0.5)_1px,transparent_1px),linear-gradient(90deg,oklch(0.85_0.16_200/0.5)_1px,transparent_1px)] [background-size:50px_50px]" />

      {/* ---------------- top nav ---------------- */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start gap-3 border-b border-[color:var(--neon)]/15 bg-black/40 px-3 py-2 backdrop-blur-md sm:gap-6 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0">
            <div className="font-title text-lg font-black leading-none neon-text sm:text-2xl">MANN</div>
            <div className="font-title text-lg font-black leading-none neon-text sm:text-2xl">VS-MANN</div>
            <div className="mt-1 hidden items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--neon-2)]" />
              EU-CENTRAL · TICK 128Hz
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 pt-1 sm:gap-3">
          <div className="clip-chamfer hidden items-center gap-2 border border-[color:var(--neon)]/25 bg-black/40 px-3 py-1.5 font-title text-xs sm:flex">
            <span className="text-[color:var(--neon)] mr-1">◆ {coins.toLocaleString("de-DE")}</span>
            <span className="text-[color:var(--neon)]/25 mr-1">|</span>
            {NAV_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  if (view !== "main") setView("main");
                }}
                className={`font-title text-[11px] font-bold tracking-widest transition px-2.5 py-1 rounded-sm ${
                  tab === t.id
                    ? "bg-[color:var(--neon)]/15 text-[color:var(--neon)] border border-[color:var(--neon)]/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            value={playerName}
            onChange={(e) => updateSettings({ playerName: e.target.value.slice(0, 14) })}
            placeholder="DEIN NAME"
            className="clip-chamfer w-24 border border-[color:var(--neon)]/25 bg-black/50 px-2 py-2 text-center text-[10px] tracking-[0.2em] outline-none focus:border-[color:var(--neon)] sm:w-36 sm:px-3 sm:text-xs sm:tracking-[0.25em]"
          />
          <button
            type="button"
            onClick={() => setView("settings")}
            aria-label="Einstellungen"
            className="clip-chamfer border border-[color:var(--neon)]/25 bg-black/40 px-3 py-2 text-sm hover:border-[color:var(--neon)]"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ---------------- desktop lobby (arcade layout) ---------------- */}
      {playing && !isMobile && (
        <>
          {/* left slanted action stack */}
          <aside className="absolute bottom-10 left-5 top-32 z-20 hidden w-[230px] flex-col justify-end gap-3 xl:flex">
            <SlantButton onClick={() => setTab("SHOP")} icon="◈" label="SHOP" tone="gold" badge="!" />
            <SlantButton onClick={() => setTab("BATTLE PASS")} icon="♛" label="BATTLE PASS" tone="violet" badge="NEW" />
            <SlantButton onClick={() => openLoadout("solo")} icon="⌖" label="LOADOUT" tone="blue" />
            <SlantButton onClick={() => setTab("SPIND & SKINS")} icon="✦" label="SPIND" tone="blue" />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={createRoom}
                disabled={busy}
                className="clip-chamfer border border-[color:var(--neon)]/50 bg-black/50 px-2 py-2 font-title text-[10px] tracking-widest hover:bg-[color:var(--neon)]/10 disabled:opacity-50"
              >
                RAUM ERSTELLEN
              </button>
              <button
                type="button"
                onClick={() => setView("join")}
                className="clip-chamfer border border-[color:var(--danger)]/60 bg-black/50 px-2 py-2 font-title text-[10px] tracking-widest text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
              >
                CUSTOM CODE
              </button>
            </div>
          </aside>

          {/* center identity + friends card */}
          <div className="absolute inset-x-0 top-24 z-20 flex flex-col items-center">
            <div className="clip-chamfer border border-[color:var(--neon)]/30 bg-black/50 px-5 py-1.5 font-title text-[11px] tracking-widest">
              <span className="text-[color:var(--neon)]">⚡ STUFE {bpLevel}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">VANGUARD OPERATIVE</span>
              <span className="ml-3 text-[color:var(--neon-2)]">BO{bestOf}</span>
            </div>
            <h2 className="mt-2 font-title text-3xl font-black neon-text">{displayName.toUpperCase()}</h2>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">
              <span className="text-[color:var(--neon)]">[AUSGERÜSTET]</span>{" "}
              {equipped.map((w) => WEAPONS[w].name).join(" · ")}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={createRoom}
                className="clip-chamfer border border-[color:var(--neon-2)]/60 bg-black/60 px-4 py-1.5 font-title text-[11px] font-black tracking-widest text-[color:var(--neon-2)] hover:bg-[color:var(--neon-2)]/15 transition flex items-center gap-2 backdrop-blur-sm shadow-md"
              >
                <span>👥</span> + FREUND EINLADEN (CUSTOM ROOM)
              </button>
            </div>
          </div>

          {/* active skin pill on lobby floor */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 backdrop-blur-md shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[color:var(--neon)]" />
            <span className="font-title text-[10px] tracking-widest text-muted-foreground">SKIN:</span>
            <span className="font-title text-xs font-bold text-white">{skin.name}</span>
            <button
              type="button"
              onClick={() => setTab("SPIND & SKINS")}
              className="ml-2 rounded bg-white/10 px-2 py-0.5 font-title text-[9px] font-bold text-[color:var(--neon)] hover:bg-white/20 transition"
            >
              ÄNDERN
            </button>
          </div>

          {/* right column: 2v2.io-style Lobby Widget */}
          <aside className="absolute bottom-6 right-6 z-20 flex w-[340px] max-w-[92vw] flex-col gap-3">
            {/* Player Info & Quick Settings */}
            <div className="flex items-center justify-between rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2.5 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate font-title text-xs font-bold tracking-wider text-white">
                  {displayName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 border border-amber-400/30">
                  {wins} WINS
                </span>
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"
                  title="Einstellungen"
                >
                  ⚙
                </button>
              </div>
            </div>

            {/* 2v2.io-Style Game Mode Card (Opens Choose Game Mode Modal) */}
            <div
              onClick={() => setModeModalOpen(true)}
              className="group relative h-44 cursor-pointer overflow-hidden rounded-xl border-2 border-yellow-400/80 bg-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.3)] transition-all duration-200 hover:scale-[1.02] hover:border-yellow-400 hover:shadow-[0_0_35px_rgba(250,204,21,0.5)]"
            >
              <img
                src={GAME_MODES[selectedMode]?.image ?? "/modes/duel.jpg"}
                alt={GAME_MODES[selectedMode]?.name ?? "Game Mode"}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

              {/* Mode Tag Badge (Top Left) */}
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="rounded-md border border-white/20 bg-black/75 px-2.5 py-1 font-title text-[10px] font-black tracking-widest text-white backdrop-blur-md shadow">
                  {GAME_MODES[selectedMode]?.badge ?? "1V1"}
                </span>
              </div>

              {/* Unranked Badge (Top Right) */}
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-yellow-400/30 bg-black/75 px-2.5 py-1 backdrop-blur-md shadow">
                <span className="font-title text-xs font-black text-yellow-400">?</span>
                <span className="font-title text-[9px] font-black tracking-wider text-white/90">UNRANKED</span>
              </div>

              {/* Bottom Mode Info & Change Button */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <div className="font-title text-xl font-black tracking-wider text-white drop-shadow-md">
                    {GAME_MODES[selectedMode]?.name?.toUpperCase() ?? "1V1 DUELS"}
                  </div>
                  <div className="text-[11px] font-medium text-white/70">
                    {GAME_MODES[selectedMode]?.sub ?? "Competitive 1v1 Battle"}
                  </div>
                </div>
                <span className="rounded-lg bg-yellow-400 px-2.5 py-1 font-title text-[10px] font-black tracking-wider text-black shadow-md transition group-hover:scale-105">
                  CHANGE
                </span>
              </div>
            </div>

            {/* Servers & Guns Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setView("join")}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 py-3 font-title text-xs font-black tracking-widest text-white shadow-md transition hover:bg-slate-800 hover:border-white/30 active:scale-95"
              >
                <span className="text-sm">🌐</span> SERVERS
              </button>
              <button
                type="button"
                onClick={() => setView("loadout")}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 py-3 font-title text-xs font-black tracking-widest text-white shadow-md transition hover:bg-slate-800 hover:border-white/30 active:scale-95"
              >
                <span className="text-sm">🔫</span> GUNS
              </button>
            </div>

            {/* Online / Solo Match Switch */}
            <div className="flex rounded-xl border border-white/15 bg-slate-950/80 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setPlayMode("online")}
                className={`flex-1 rounded-lg py-1.5 text-center font-title text-[10px] font-black tracking-wider transition ${
                  playMode === "online"
                    ? "bg-[color:var(--neon)] text-black shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                🌐 ONLINE MATCH
              </button>
              <button
                type="button"
                onClick={() => setPlayMode("bot")}
                className={`flex-1 rounded-lg py-1.5 text-center font-title text-[10px] font-black tracking-wider transition ${
                  playMode === "bot"
                    ? "bg-amber-400 text-black shadow"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                🤖 SOLO BOTS
              </button>
            </div>

            {error && <p className="text-center text-xs font-bold text-red-400">{error}</p>}

            {/* Big Yellow PLAY Button */}
            <button
              type="button"
              onClick={() => {
                const modeInfo = GAME_MODES[selectedMode] ?? GAME_MODES.duel;
                updateSettings({ gameMode: selectedMode, unlimitedMats: modeInfo.unlimitedMats });
                if (playMode === "online") {
                  startQuickplay();
                } else {
                  onStart({
                    opponent: "NOVA-BOT",
                    opponentSkin: "ogmodel",
                    roomCode: "TRAINING",
                    online: false,
                    isHost: true,
                    gameMode: selectedMode,
                  });
                }
              }}
              className="group relative flex w-full items-center justify-center rounded-xl bg-[#facc15] py-4 text-center shadow-[0_4px_25px_rgba(250,204,21,0.5)] transition-all duration-150 hover:bg-[#fde047] hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="font-title text-3xl font-black tracking-[0.25em] text-black drop-shadow-sm">
                {playMode === "online" ? "MATCH SUCHEN" : "PLAY"}
              </span>
            </button>
          </aside>
        </>
      )}


      {/* ---------------- mobile lobby ---------------- */}
      {playing && isMobile && (
        <div className="absolute inset-x-0 bottom-0 top-[68px] z-20 overflow-y-auto px-3 pb-4 pt-2">
          <div className="flex flex-col gap-3">
            <Chamfer className="p-3 text-center">
              <div className="font-title text-[10px] tracking-widest text-[color:var(--neon)]">
                ● VANGUARD OPERATIVE · BO{bestOf}
              </div>
              <div className="mt-1 font-title text-2xl font-black neon-text">{displayName.toUpperCase()}</div>
              <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">
                {equipped.map((w) => WEAPONS[w].name).join(" · ")}
              </div>
              <div className="mt-2 flex justify-center gap-3 font-title text-[10px] tracking-widest">
                <span className="text-[color:var(--neon)]">◆ {coins.toLocaleString("de-DE")}</span>
                <span className="text-[color:var(--neon-2)]">⬤ {owned.length} SKINS</span>
              </div>
            </Chamfer>

            {/* Game mode card */}
            <div
              onClick={() => setModeModalOpen(true)}
              className="relative h-24 cursor-pointer overflow-hidden rounded-xl border border-yellow-400/80 bg-slate-950 shadow-md"
            >
              <img
                src={GAME_MODES[selectedMode]?.image ?? "/modes/duel.jpg"}
                alt={GAME_MODES[selectedMode]?.name ?? "Game Mode"}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute left-2.5 top-2 rounded bg-black/70 px-2 py-0.5 font-title text-[9px] font-bold text-white border border-white/20">
                {GAME_MODES[selectedMode]?.badge ?? "MODE"}
              </div>
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                <div>
                  <div className="font-title text-base font-black text-white">{GAME_MODES[selectedMode]?.name?.toUpperCase()}</div>
                  <div className="text-[10px] text-white/70">{GAME_MODES[selectedMode]?.sub}</div>
                </div>
                <span className="rounded bg-yellow-400 px-2 py-1 font-title text-[9px] font-black text-black">
                  ÄNDERN
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const modeInfo = GAME_MODES[selectedMode] ?? GAME_MODES.duel;
                updateSettings({ gameMode: selectedMode, unlimitedMats: modeInfo.unlimitedMats });
                onStart({
                  opponent: "NOVA-BOT",
                  opponentSkin: "ogmodel",
                  roomCode: "TRAINING",
                  online: false,
                  isHost: true,
                  gameMode: selectedMode,
                });
              }}
              className="flex w-full items-center justify-center rounded-xl bg-[#facc15] py-4 text-center shadow-lg transition active:scale-95"
            >
              <span className="font-title text-2xl font-black tracking-[0.2em] text-black">
                PLAY
              </span>
            </button>

            <button
              type="button"
              onClick={() => openLoadout("quick")}
              className="clip-chamfer flex w-full items-center justify-between border border-[color:var(--neon-2)]/60 bg-black/50 px-4 py-3 font-title text-[12px] tracking-widest text-[color:var(--neon-2)]"
            >
              LIVE-MATCH SUCHEN
              <span className="text-[9px]">ECHTER GEGNER</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={createRoom}
                disabled={busy}
                className="clip-chamfer border border-[color:var(--neon)]/50 bg-black/50 px-3 py-3 font-title text-[11px] tracking-widest disabled:opacity-50"
              >
                RAUM ERSTELLEN
              </button>
              <button
                type="button"
                onClick={() => setView("join")}
                className="clip-chamfer border border-[color:var(--danger)]/60 bg-black/50 px-3 py-3 font-title text-[11px] tracking-widest text-[color:var(--danger)]"
              >
                RAUM BEITRETEN
              </button>
              <button
                type="button"
                onClick={() => setView("settings")}
                className="clip-chamfer border border-[color:var(--neon)]/25 bg-black/50 px-3 py-3 font-title text-[11px] tracking-widest"
              >
                EINSTELLUNGEN ⚙
              </button>
              <button
                type="button"
                onClick={() => setView("howto")}
                className="clip-chamfer border border-[color:var(--neon)]/25 bg-black/50 px-3 py-3 font-title text-[11px] tracking-widest"
              >
                STEUERUNG
              </button>
            </div>

            <Chamfer className="p-3">
              <div className="text-[10px] tracking-[0.3em] text-muted-foreground">● KARTE</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {MAPS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateSettings({ mapId: m.id })}
                    className={`clip-chamfer border px-2 py-2 text-left ${
                      m.id === mapId
                        ? "border-[color:var(--neon)] bg-[color:var(--neon)]/10"
                        : "border-border/60 bg-black/40"
                    }`}
                  >
                    <div className="font-title text-[11px]">{m.name}</div>
                    <div className="text-[9px] tracking-widest text-muted-foreground">{m.tag}</div>
                  </button>
                ))}
              </div>
            </Chamfer>

            <Chamfer className="p-3">
              <div className="text-[10px] tracking-[0.3em] text-muted-foreground">● FARBVARIANTE</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SKINS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateSettings({ skin: s.id })}
                    className={`clip-chamfer h-11 w-11 border transition ${
                      s.id === skinId ? "scale-110 border-[color:var(--neon)]" : "border-border/60"
                    }`}
                    style={{ background: `linear-gradient(140deg, ${s.suit}, ${s.accent})` }}
                    aria-label={s.name}
                  />
                ))}
              </div>
            </Chamfer>

            <Chamfer className="p-3">
              <div className="flex items-center justify-between font-title text-[10px] tracking-widest">
                <span className="text-[color:var(--neon)]">● LOBBY</span>
                <span className="text-[color:var(--neon-2)]">{ready ? "BEREIT" : "AKTIV"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="border border-[color:var(--neon)] bg-[color:var(--neon)]/10 px-2 py-2 text-center">
                  <div className="text-[9px] tracking-widest text-muted-foreground">DU</div>
                  <div className="truncate font-title text-xs">{displayName.toUpperCase()}</div>
                </div>
                <div className="border border-dashed border-border/60 bg-black/40 px-2 py-2 text-center">
                  <div className="text-[9px] tracking-widest text-muted-foreground">GEGNER</div>
                  <div className="truncate font-title text-xs">
                    {opponent ? opponent.name.toUpperCase() : "BOT / OFFEN"}
                  </div>
                </div>
              </div>
            </Chamfer>

            {error && <p className="text-center text-xs text-[color:var(--danger)]">{error}</p>}
          </div>
        </div>
      )}



      {tab !== "SPIELEN" && (
        <TabPanel
          tab={tab}
          coins={coins}
          shopMsg={shopMsg}
          skinId={skinId}
          isOwned={isOwned}
          onEquip={equipSkin}
          onBuy={buySkin}
          mmr={mmr}
          wins={wins}
          losses={losses}
          onClose={() => setTab("SPIELEN")}
        />
      )}

      {/* ---------------- overlays ---------------- */}
      {overlay && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          {view === "queue" && (
            <div className="panel w-[420px] max-w-[92vw] p-7 text-center">
              <h2 className="font-title text-2xl font-bold neon-text">MATCH-SERVER</h2>
              <p className="mt-1 text-xs tracking-widest text-muted-foreground">
                SUCHE ECHTEN GEGNER · EU-CENTRAL · BO{bestOf}
              </p>
              <div className="mt-6 font-title text-5xl font-black tabular-nums">
                {String(Math.floor((queueInfo?.seconds ?? 0) / 60)).padStart(2, "0")}:
                {String((queueInfo?.seconds ?? 0) % 60).padStart(2, "0")}
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden bg-black/60">
                <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] bg-[color:var(--neon-2)]" />
              </div>
              <p className="mt-3 text-[11px] tracking-widest text-muted-foreground">
                {queueInfo ? `${queueInfo.queued} SPIELER IN DER WARTESCHLANGE` : "VERBINDE…"}
              </p>
              {error && <p className="mt-2 text-sm text-[color:var(--danger)]">{error}</p>}
              <div className="mt-6 space-y-3">
                <NeonButton variant="ghost" onClick={stopQueue}>
                  Suche abbrechen
                </NeonButton>
              </div>
            </div>
          )}

          {view === "join" && (
            <div className="panel w-[400px] max-w-[92vw] p-6">
              <h2 className="font-title text-2xl font-bold neon-text">ROOM BEITRETEN</h2>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={8}
                className="mt-4 w-full border border-border bg-black/50 px-4 py-3 text-center font-title text-2xl tracking-[0.4em] outline-none focus:border-[color:var(--neon)]"
              />
              {error && <p className="mt-2 text-sm text-[color:var(--danger)]">{error}</p>}
              <div className="mt-5 space-y-3">
                <NeonButton onClick={() => void joinRoom()} disabled={code.trim().length < 4 || busy}>
                  Beitreten
                </NeonButton>
                <NeonButton variant="ghost" onClick={() => setView("main")}>
                  Zurück
                </NeonButton>
              </div>
            </div>
          )}

          {view === "room" && (
            <div className="panel w-[420px] max-w-[92vw] p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-title text-2xl font-bold neon-text">ROOM</h2>
                <span className="font-title text-xl tracking-[0.35em]">{roomCode || "—"}</span>
              </div>
              <p className="mt-1 text-xs tracking-wider text-muted-foreground">{status}</p>

              <div className="mt-4 flex gap-2">
                <input
                  readOnly
                  value={roomCode ? roomLink(roomCode) : ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 border border-border bg-black/50 px-3 py-2 text-xs text-muted-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!roomCode}
                  className="border border-[color:var(--neon)]/60 px-3 text-xs tracking-widest text-[color:var(--neon)] hover:bg-[color:var(--neon)]/10"
                >
                  {copied ? "OK" : "LINK"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="border border-[color:var(--neon-2)]/50 bg-black/30 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">DU</div>
                  <div className="font-title text-lg">{displayName}</div>
                  <div
                    className={`mt-1 text-[11px] tracking-widest ${ready ? "text-[color:var(--neon-2)]" : "text-muted-foreground"}`}
                  >
                    {ready ? "READY" : "NICHT BEREIT"}
                  </div>
                </div>
                <div className="border border-[color:var(--danger)]/50 bg-black/30 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">GEGNER</div>
                  <div className="font-title text-lg">{opponent?.name ?? "…"}</div>
                  <div
                    className={`mt-1 text-[11px] tracking-widest ${opponentReady ? "text-[color:var(--neon-2)]" : "text-muted-foreground"}`}
                  >
                    {opponent ? (opponentReady ? "READY" : "WARTET") : "LEER"}
                  </div>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p>}

              <div className="mt-5 space-y-3">
                <NeonButton onClick={() => openLoadout("ready")} disabled={!opponent || ready}>
                  {ready ? "Warte auf Start…" : "Waffen wählen & bereit"}
                </NeonButton>
                <NeonButton
                  variant="danger"
                  onClick={() => {
                    connection.leave();
                    resetRoomState();
                    setRoomCode("");
                    setView("main");
                  }}
                >
                  Room verlassen
                </NeonButton>
              </div>
            </div>
          )}

          {view === "loadout" && (
            <div className="panel flex max-h-[92vh] w-[420px] max-w-[92vw] flex-col overflow-y-auto p-4 sm:p-6">
              <h2 className="font-title text-xl font-bold neon-text sm:text-2xl">WAFFEN WÄHLEN</h2>
              <p className="mt-1 text-[11px] tracking-widest text-muted-foreground">
                WÄHLE {LOADOUT_SLOTS} WAFFEN — LEER = ZUFÄLLIG
              </p>
              {pending === "solo" && (
                <div className="mt-4">
                  <p className="text-[11px] tracking-widest text-[color:var(--neon)]">BOT-STÄRKE</p>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {BOT_LEVELS.map((b) => (
                      <button
                        key={b.level}
                        type="button"
                        onClick={() => updateSettings({ botLevel: b.level })}
                        className={`border px-1 py-2 text-center transition ${
                          botLevel === b.level
                            ? "border-[color:var(--neon)] bg-[color:var(--neon)]/10"
                            : "border-border/60 hover:border-foreground/50"
                        }`}
                      >
                        <span className="block font-title text-sm">{b.level}</span>
                        <span className="block text-[9px] leading-tight tracking-wider text-muted-foreground">
                          {b.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] tracking-widest text-[color:var(--neon)]">ANZAHL BOTS</p>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((n) => {
                      const locked = n === 0 && mapId !== "training";
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={locked}
                          onClick={() => updateSettings({ botCount: n })}
                          className={`border px-1 py-2 text-center transition ${
                            locked
                              ? "cursor-not-allowed border-border/30 opacity-40"
                              : botCount === n
                                ? "border-[color:var(--neon)] bg-[color:var(--neon)]/10"
                                : "border-border/60 hover:border-foreground/50"
                          }`}
                        >
                          <span className="block font-title text-sm">{n === 0 ? "0" : n}</span>
                          <span className="block text-[9px] leading-tight tracking-wider text-muted-foreground">
                            {n === 0 ? "KEINE" : n === 1 ? "1V1" : "BOTS"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] tracking-wider text-muted-foreground">
                    {mapId === "training"
                      ? "Im TRAINING YARD kannst du auch ganz ohne Bots üben."
                      : "Ohne Bots geht nur im TRAINING YARD."}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] tracking-widest text-[color:var(--neon)]">UNBEGRENZTE MATERIALIEN</span>
                    <button
                      type="button"
                      onClick={() => updateSettings({ unlimitedMats: !unlimitedMats })}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        unlimitedMats ? "bg-[color:var(--neon)]" : "bg-border"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          unlimitedMats ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-4 max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                {WEAPON_ORDER.map((id) => {
                  const w = WEAPONS[id];
                  const idx = loadout.indexOf(id);
                  const active = idx >= 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleWeapon(id)}
                      className={`flex w-full items-center gap-3 border px-3 py-2 text-left transition ${
                        active
                          ? "border-[color:var(--neon)] bg-[color:var(--neon)]/10"
                          : "border-border/60 hover:border-foreground/50"
                      }`}
                    >
                      <span
                        className="flex h-9 w-12 shrink-0 items-center justify-center border border-black/40"
                        style={{ background: `linear-gradient(135deg, ${w.color}22, #0d1118)` }}
                      >
                        <WeaponIcon id={id} color={w.color} className="h-6 w-10" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-title text-sm" style={{ color: w.color }}>
                          {w.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">{w.role}</span>
                      </span>
                      <span className="font-title text-xs tracking-widest text-muted-foreground">
                        {active ? `SLOT ${idx + 1}` : `${w.damage}×${w.pellets}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 space-y-3">
                <NeonButton variant="ghost" onClick={randomize}>
                  Zufällig generieren
                </NeonButton>
                <NeonButton onClick={confirmLoadout}>
                  {pending === "solo" ? "Match starten" : pending === "ready" ? "Bereit" : pending === "quick" ? "Gegner suchen" : "Fertig"}
                </NeonButton>
                <NeonButton
                  variant="ghost"
                  onClick={() => {
                    const back = pending === "ready" ? "room" : "main";
                    setPending(null);
                    setView(back);
                  }}
                >
                  Zurück
                </NeonButton>
              </div>
            </div>
          )}

          {view === "settings" && <SettingsPanel onClose={() => setView("main")} />}

          {view === "howto" && (
            <div className="panel w-[460px] max-w-[92vw] p-6">
              <h2 className="font-title text-2xl font-bold neon-text">STEUERUNG</h2>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <b className="text-foreground">WASD</b> Bewegung · <b className="text-foreground">Shift</b> Sprint ·{" "}
                  <b className="text-foreground">Strg</b> Ducken
                </li>
                <li>
                  <b className="text-foreground">Space</b> Springen · Air-Strafe in der Luft
                </li>
                <li>
                  <b className="text-foreground">1–3</b> Loadout-Waffen · <b className="text-foreground">Mausrad</b>{" "}
                  wechseln
                </li>
                <li>
                  <b className="text-foreground">LMB</b> Schießen · <b className="text-foreground">RMB</b> Scope ·{" "}
                  <b className="text-foreground">R</b> Nachladen
                </li>
                <li>
                  <b className="text-foreground">Q/V/C/F</b> Wand, Rampe, Boden, Dach · LMB halten = Turbo
                </li>
                <li>
                  <b className="text-foreground">G</b> Edit · Kacheln markieren · <b className="text-foreground">G</b>{" "}
                  bestätigen · <b className="text-foreground">T</b> Reset
                </li>
                <li>
                  <b className="text-foreground">ESC</b> Pause
                </li>
              </ul>
              <div className="mt-6">
                <NeonButton onClick={() => setView("main")}>Zurück</NeonButton>
              </div>
            </div>
          )}
        </div>
      )}

      <GameModeModal
        open={modeModalOpen}
        onClose={() => setModeModalOpen(false)}
        onSelectMode={(mode, offline) => {
          setSelectedMode(mode);
          updateSettings({ gameMode: mode });
          if (!offline) {
            startQuickplay();
          }
        }}
      />
    </div>
  );
}

function Locked({ title, note }: { title: string; note: string }) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none select-none opacity-25 blur-[3px]">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="clip-chamfer h-24 border border-[color:var(--neon)]/25"
              style={{
                background: `linear-gradient(140deg, ${SKINS[i % SKINS.length]!.suit}, ${SKINS[i % SKINS.length]!.accent})`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-center">
        <div className="font-title text-3xl font-black neon-text">{title}</div>
        <div className="text-sm tracking-widest text-muted-foreground">{note}</div>
        <div className="clip-chamfer mt-2 border border-[color:var(--danger)]/60 px-3 py-1 font-title text-[11px] tracking-widest text-[color:var(--danger)]">
          🔒 GESPERRT
        </div>
      </div>
    </div>
  );
}

function TabPanel({
  tab,
  coins,
  shopMsg,
  skinId,
  isOwned,
  onEquip,
  onBuy,
  mmr,
  wins,
  losses,
  onClose,
}: {
  tab: string;
  coins: number;
  shopMsg: string;
  skinId: string;
  isOwned: (id: string) => boolean;
  onEquip: (id: string) => void;
  onBuy: (id: string) => void;
  mmr: number;
  wins: number;
  losses: number;
  onClose: () => void;
}) {
  const equipped = getSkin(skinId);
  const rank = rankFor(mmr);
  const nxt = nextRank(mmr);
  return (
    <div className="absolute inset-x-0 bottom-2 top-[68px] z-20 mx-auto w-[min(1000px,96vw)] sm:bottom-6 lg:top-28">
      <Chamfer className="flex h-full flex-col p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-2xl font-black neon-text">{tab}</h2>
          <div className="flex items-center gap-3">
            {tab === "SHOP" && (
              <span className="clip-chamfer border border-[color:var(--neon)]/40 px-3 py-1 font-title text-xs text-[color:var(--neon)]">
                ◆ {coins.toLocaleString("de-DE")}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="clip-chamfer border border-[color:var(--neon)]/30 px-3 py-1 font-title text-xs tracking-widest hover:border-[color:var(--neon)]"
            >
              ZURÜCK
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "SPIND & SKINS" && (
            <div className="flex h-full min-h-0 flex-col gap-3">
            {shopMsg && <p className="text-sm text-[color:var(--neon-2)]">{shopMsg}</p>}
            <div className="flex min-h-0 flex-1 gap-4">
              {/* big preview of the equipped skin */}
              <div className="relative hidden w-[38%] shrink-0 self-stretch overflow-hidden border border-[color:var(--neon)]/25 lg:flex">
                <SkinPortrait skin={equipped} fov={24} scale={0.6} offsetY={0.23} className="h-full w-full" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                  <div
                    className="font-title text-[11px] tracking-[0.3em]"
                    style={{ color: RARITY_COLOR[equipped.rarity] }}
                  >
                    {equipped.rarity.toUpperCase()}
                  </div>
                  <div className="font-title text-3xl font-black">{equipped.name}</div>
                  <div className="text-[11px] text-muted-foreground">{equipped.tag}</div>
                  <div className="mt-2 text-[10px] tracking-[0.3em] text-[color:var(--neon)]">● AUSGERÜSTET</div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {SKINS.map((s) => {
                    const own = isOwned(s.id);
                    const active = s.id === skinId;
                    const rc = RARITY_COLOR[s.rarity];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => (own ? onEquip(s.id) : onBuy(s.id))}
                        className="clip-chamfer group relative overflow-hidden border text-left transition"
                        style={{
                          borderColor: active ? "var(--neon)" : `${rc}66`,
                          boxShadow: active ? `0 0 18px ${rc}55` : "none",
                          opacity: own ? 1 : 0.72,
                        }}
                      >
                        <SkinPortrait skin={s} className="h-40 w-full" />
                        <div className="absolute left-0 right-0 top-0 h-1" style={{ background: rc }} />
                        {!own && (
                          <span className="absolute right-2 top-2 clip-chamfer border border-border/60 bg-black/70 px-2 py-0.5 text-[9px] tracking-widest">
                            🔒
                          </span>
                        )}
                        {active && (
                          <span className="absolute right-2 top-2 clip-chamfer bg-[color:var(--neon)] px-2 py-0.5 text-[9px] font-bold tracking-widest text-black">
                            AKTIV
                          </span>
                        )}
                        <div className="relative bg-black/70 px-3 py-2">
                          <div className="font-title text-sm leading-tight">{s.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">{s.tag}</div>
                          <div className="mt-1 text-[10px] font-bold tracking-widest" style={{ color: rc }}>
                            {active ? "AUSGERÜSTET" : own ? "AUSRÜSTEN" : `◆ ${s.price.toLocaleString("de-DE")}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          )}

          {tab === "SHOP" && (
            <>
              {shopMsg && <p className="mb-3 text-sm text-[color:var(--neon-2)]">{shopMsg}</p>}
              <WeeklyDrop />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SKINS.filter((s) => s.price > 0).map((s) => {
                  const own = isOwned(s.id);
                  const rc = RARITY_COLOR[s.rarity];
                  return (
                    <div
                      key={s.id}
                      className="clip-chamfer overflow-hidden border"
                      style={{ borderColor: `${rc}66` }}
                    >
                      <div className="relative">
                        <SkinPortrait skin={s} className="h-40 w-full" />
                        <div className="absolute left-0 right-0 top-0 h-1" style={{ background: rc }} />
                        <span
                          className="absolute right-2 top-2 clip-chamfer bg-black/70 px-2 py-0.5 text-[9px] font-bold tracking-widest"
                          style={{ color: rc }}
                        >
                          {s.rarity.toUpperCase()}
                        </span>
                      </div>
                      <div className="bg-black/70 p-3">
                        <div className="font-title text-sm">{s.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{s.tag}</div>
                        <button
                          type="button"
                          onClick={() => (own ? onEquip(s.id) : onBuy(s.id))}
                          className={`clip-chamfer mt-2 w-full border px-2 py-1.5 font-title text-[11px] tracking-widest transition ${
                            own
                              ? "border-[color:var(--neon-2)]/60 text-[color:var(--neon-2)] hover:bg-[color:var(--neon-2)]/10"
                              : coins >= s.price
                                ? "border-[color:var(--neon)]/60 text-[color:var(--neon)] hover:bg-[color:var(--neon)]/10"
                                : "border-border/50 text-muted-foreground"
                          }`}
                        >
                          {own ? "AUSRÜSTEN" : `◆ ${s.price.toLocaleString("de-DE")}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}


          {tab === "BATTLE PASS" && (
            <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
              <div className="min-h-0 flex-1">
                <BattlePassPanel />
              </div>
              <div className="w-full shrink-0 overflow-y-auto border-t border-border/50 pt-4 lg:w-[300px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <DailyChallenges />
              </div>
            </div>
          )}


          {tab === "STATISTIK" && <MatchStats />}

          {tab === "RANGLISTE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="clip-chamfer border border-border/60 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">RANG</div>
                  <div className="font-title text-lg flex items-center justify-center gap-1.5" style={{ color: rank.color }}>
                    <span className="text-xl">{rank.icon}</span> <span>{rank.name}</span>
                  </div>
                </div>
                <div className="clip-chamfer border border-border/60 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">WERTUNG</div>
                  <div className="font-title text-lg">{mmr}</div>
                </div>
                <div className="clip-chamfer border border-border/60 p-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground">BILANZ</div>
                  <div className="font-title text-lg">
                    {wins} : {losses}
                  </div>
                </div>
              </div>
              <div className="h-1.5 w-full bg-black/60">
                <div
                  className="h-full"
                  style={{ width: `${Math.round(progressToNext(mmr) * 100)}%`, background: rank.color }}
                />
              </div>
              <div className="text-[11px] tracking-widest text-muted-foreground">
                {nxt ? `NÄCHSTE STUFE: ${nxt.name} AB ${nxt.min} (${Math.max(0, nxt.min - mmr)} PUNKTE)` : "HÖCHSTE STUFE ERREICHT"}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RANKS.map((r) => (
                  <div
                    key={r.id}
                    className="clip-chamfer border px-3 py-2 text-[11px]"
                    style={{ borderColor: r.id === rank.id ? r.color : "rgba(120,130,140,0.35)" }}
                  >
                    <span className="font-title" style={{ color: r.color }}>
                      <span className="mr-1">{r.icon}</span>{r.name}
                    </span>
                    <span className="ml-2 text-muted-foreground">{r.min}+</span>
                  </div>
                ))}
              </div>
              <div className="clip-chamfer border border-border/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
                Jedes beendete Duell aktualisiert deine Wertung nach dem Elo-Verfahren (K = 32). Ein Sieg gegen
                höher gewertete Gegner bringt mehr Punkte, eine Niederlage gegen schwächere kostet mehr.
                Siegquote: {wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0}%
                {" · "}Matches: {wins + losses}
              </div>
              {!RANKED_OPEN && (
                <Locked title="RANGLISTE" note="Noch nicht offen — die Saison startet bald." />
              )}
            </div>
          )}
        </div>
      </Chamfer>
    </div>
  );
}



/** free weekly coin drop, claimed by tapping the card */
function WeeklyDrop() {
  const weeklyClaimed = useSettings((st) => st.weeklyClaimed);
  const [msg, setMsg] = useState("");
  const ready = weeklyReady();
  void weeklyClaimed;
  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={!ready}
        onClick={() => setMsg(claimWeekly())}
        className={`clip-chamfer flex w-full items-center justify-between gap-4 border p-4 text-left transition ${
          ready
            ? "border-[color:var(--neon)]/70 bg-[color:var(--neon)]/10 hover:bg-[color:var(--neon)]/20"
            : "border-border/50 opacity-70"
        }`}
      >
        <span>
          <span className="block font-title text-sm tracking-widest text-[color:var(--neon)]">
            WOCHENBONUS
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {ready
              ? `Jede Woche gratis: ${WEEKLY_COINS} Coins abholen`
              : "Diese Woche schon abgeholt — Montag gibt es neue Coins"}
          </span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Duell-Einsatz: {MATCH_STAKE} Coins · Sieg bringt {MATCH_STAKE + WIN_BONUS} Coins
          </span>
        </span>
        <span className="font-title text-xl text-[color:var(--neon)]">
          {ready ? `◆ +${WEEKLY_COINS}` : "✓"}
        </span>
      </button>
      {msg && <p className="mt-2 text-sm text-[color:var(--neon-2)]">{msg}</p>}
    </div>
  );
}

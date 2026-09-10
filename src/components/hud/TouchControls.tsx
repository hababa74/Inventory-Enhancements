import { useEffect, useRef, useState } from "react";
import { input, virtualDown, virtualPress, virtualUp } from "../../game/input";
import { engine } from "../../game/engine";
import { settingsStore, useHud, useSettings } from "../../game/store";
import { MATS, WEAPONS } from "../../game/constants";
import { WeaponIcon } from "./WeaponIcon";

function key(action: string, fallback: string) {
  return settingsStore.get().keys[action] ?? fallback;
}

/** round glass button, 1v1-style */
function RoundBtn({
  size = 56,
  active = false,
  onDown,
  onUp,
  children,
  label,
}: {
  size?: number;
  active?: boolean;
  onDown: () => void;
  onUp?: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full border-2 backdrop-blur-[2px] transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: active ? "var(--neon)" : "rgba(255,255,255,0.75)",
        background: active ? "rgba(80,230,255,0.28)" : "rgba(255,255,255,0.12)",
        color: active ? "var(--neon)" : "#ffffff",
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        buzz();
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onUp?.();
      }}
      onPointerCancel={() => onUp?.()}
      onPointerLeave={() => onUp?.()}
    >
      {children}
    </button>
  );
}

const ico = "h-6 w-6";

/** short vibration on touch, if the player allows it */
function buzz() {
  if (!settingsStore.get().hapticFeedback) return;
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
}

function IconJump() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 4l6 7h-4v6h-4v-6H6z" fill="currentColor" opacity={0.9} />
      <path d="M6 20h12" />
    </svg>
  );
}
function IconAim() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}
function IconCrouch() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="13" cy="4.5" r="2" fill="currentColor" />
      <path d="M14 8l-4 4 3 3-1 6M10 12l-5 2M13 15l4 3" />
    </svg>
  );
}
function IconReload() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
      <path d="M14 5l3 3" />
    </svg>
  );
}
function IconRotate() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v5h5" />
    </svg>
  );
}
function IconFire() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor">
      <path d="M12 1.5l2.6 6.1 6.4-2.2-3.4 5.7 5.4 3.3-6.6.9 1.4 6.6-5.8-3.6-4.6 4.4.6-6.7-6.6-1.5 5.6-3.6L3 4.5l6.6 2.4z" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19" />
    </svg>
  );
}

function BuildIcon({ kind }: { kind: "wall" | "ramp" | "floor" | "roof" }) {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
      {kind === "wall" && (
        <>
          <path d="M8 5h16v22H8z" fill="currentColor" opacity={0.18} />
          <path d="M8 5l4-2v22l-4 2z" fill="currentColor" opacity={0.35} />
        </>
      )}
      {kind === "ramp" && (
        <>
          <path d="M5 26h6v-5h5v-5h5v-5h6" />
          <path d="M5 26h22" />
          <path d="M5 26L27 6" opacity={0.5} />
        </>
      )}
      {kind === "floor" && (
        <>
          <path d="M4 18l12-6 12 6-12 6z" fill="currentColor" opacity={0.2} />
          <path d="M4 18v3l12 6 12-6v-3" />
        </>
      )}
      {kind === "roof" && (
        <>
          <path d="M16 5l11 11-11 11L5 16z" fill="currentColor" opacity={0.18} />
          <path d="M16 5v22M5 16h22" opacity={0.6} />
        </>
      )}
    </svg>
  );
}

/** Mobile controls modelled on 1v1-style touch layouts. */
export function TouchControls() {
  const [show, setShow] = useState(false);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const moveId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [crouch, setCrouch] = useState(false);
  const [sprint, setSprint] = useState(false);
  const [compact, setCompact] = useState(false);
  const sprintActive = useRef(false);

  const buildMode = useHud((s) => s.buildMode);
  const editMode = useHud((s) => s.editMode);
  const buildType = useHud((s) => s.buildType);
  const weapon = useHud((s) => s.weapon);
  const loadout = useHud((s) => s.loadout);
  const hp = useHud((s) => s.hp);
  const shieldV = useHud((s) => s.shield);
  const ammo = useHud((s) => s.ammo);
  const reserve = useHud((s) => s.reserve);
  const scoped = useHud((s) => s.scoped);
  const material = useHud((s) => s.material);
  const matWood = useHud((s) => s.matWood);
  const matStone = useHud((s) => s.matStone);
  const matMetal = useHud((s) => s.matMetal);
  const touchSens = useSettings((st) => st.touchSensitivity);
  const hudScale = useSettings((st) => st.hudScale);
  const hudOpacity = useSettings((st) => st.hudOpacity);
  const leftHanded = useSettings((st) => st.leftHanded);
  const editSel = useHud((s) => s.editTiles);
  const editSolid = useHud((s) => s.editPieceTiles);

  useEffect(() => {
    setShow(window.matchMedia("(pointer: coarse)").matches);
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setCompact(Math.min(w, h) < 400 || h < 430);
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (!show) return null;

  const sc = (n: number) => Math.round(n * hudScale);
  const btn = sc(compact ? 44 : 56);
  const small = sc(compact ? 42 : 52);
  const fireSize = sc(compact ? 64 : 78);
  const stickSize = sc(compact ? 104 : 128);
  const matCounts: Record<string, number> = { wood: matWood, stone: matStone, metal: matMetal };
  // left-handed players get the stick and the action cluster mirrored
  const stickSide = leftHanded ? "right-4" : "left-4";
  const actionSide = leftHanded ? "left-4" : "right-4";
  const pieceSide = leftHanded ? "left-2" : "right-2";

  const buildBtn = (kind: "wall" | "ramp" | "floor" | "roof", action: string, fallback: string) => (
    <button
      type="button"
      aria-label={kind}
      className="pointer-events-auto flex items-center justify-center rounded-md border backdrop-blur-[2px]"
      style={{
        width: compact ? 40 : 48,
        height: compact ? 40 : 48,
        borderColor: buildType === kind && buildMode ? "var(--neon)" : "rgba(255,255,255,0.6)",
        background: buildType === kind && buildMode ? "rgba(80,230,255,0.25)" : "rgba(255,255,255,0.12)",
        color: buildType === kind && buildMode ? "var(--neon)" : "#ffffff",
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        virtualPress(key(action, fallback));
      }}
    >
      <BuildIcon kind={kind} />
    </button>
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 select-none"
      style={{
        touchAction: "none",
        opacity: hudOpacity,
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* look / aim area — full screen behind the buttons */}
      <div
        className="pointer-events-auto absolute inset-0 z-0"
        onPointerDown={(e) => {
          if (e.clientX < window.innerWidth * 0.32 && e.clientY > window.innerHeight * 0.45) return;
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
          lookId.current = e.pointerId;
          lookLast.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (lookId.current !== e.pointerId) return;
          input.lookX = (e.clientX - lookLast.current.x) * 0.45 * touchSens;
          input.lookY = (e.clientY - lookLast.current.y) * 0.45 * touchSens;
          lookLast.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (lookId.current === e.pointerId) {
            try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
            lookId.current = null;
          }
        }}
        onPointerCancel={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          lookId.current = null;
        }}
      />

      {/* edit mode: tap the tiles, then confirm */}
      {editMode && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3">
          <div className="pointer-events-auto grid grid-cols-3 gap-1">
            {editSel.map((marked, i) => {
              const isSolid = editSolid[i] !== false;
              const willBeSolid = marked ? !isSolid : isSolid;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Kachel ${i + 1}`}
                  className="rounded-[3px] border-2"
                  style={{
                    width: compact ? 44 : 56,
                    height: compact ? 44 : 56,
                    borderColor: marked ? "#48ff9e" : "rgba(160,190,220,0.5)",
                    background: willBeSolid ? "rgba(72,255,158,0.22)" : "rgba(10,20,30,0.25)",
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engine.toggleEditTile(i);
                  }}
                />
              );
            })}
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border-2 border-[color:var(--neon)] bg-[color:var(--neon)]/25 px-4 py-2 font-display text-sm font-bold text-white"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine.confirmEdit();
              }}
            >
              ✓ ÜBERNEHMEN
            </button>
            <button
              type="button"
              className="rounded-md border-2 border-white/60 bg-black/45 px-3 py-2 font-display text-sm font-bold text-white"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine.resetEditedPiece();
              }}
            >
              ⟲
            </button>
            <button
              type="button"
              className="rounded-md border-2 border-[color:var(--danger)]/70 bg-black/45 px-3 py-2 font-display text-sm font-bold text-[color:var(--danger)]"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine.cancelEdit();
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* vitals */}
      <div
        className="absolute left-4 z-30 space-y-1"
        style={{ width: compact ? 120 : 160, bottom: compact ? undefined : 228, top: compact ? 44 : undefined }}
      >
        <div className="relative h-4 overflow-hidden rounded-sm border border-white/40 bg-black/45">
          <div className="h-full bg-[color:var(--neon-2)]" style={{ width: `${shieldV}%` }} />
          <span className="absolute inset-0 text-center text-[11px] font-bold leading-4 text-white">{Math.round(shieldV)}</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-sm border border-white/40 bg-black/45">
          <div className="h-full bg-[#3dff9e]" style={{ width: `${hp}%` }} />
          <span className="absolute inset-0 text-center text-[11px] font-bold leading-4 text-black">{Math.round(hp)}</span>
        </div>
      </div>

      {/* pause */}
      <div className="absolute right-2 top-2 z-30">
        <RoundBtn size={compact ? 40 : 48} label="Pause" onDown={() => virtualPress("Escape")}>
          <IconGear />
        </RoundBtn>
      </div>

      <div
        ref={stick}
        className={`pointer-events-auto absolute bottom-6 ${stickSide} z-30 rounded-full border-2`}
        style={{
          width: stickSize,
          height: stickSize,
          borderColor: "rgba(255,255,255,0.65)",
          background: "rgba(255,255,255,0.08)",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
          const r = stick.current!.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          moveId.current = e.pointerId;
        }}
        onPointerMove={(e) => {
          if (moveId.current !== e.pointerId || !origin.current) return;
          const dx = (e.clientX - origin.current.x) / 58;
          const dy = (e.clientY - origin.current.y) / 58;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, len) / len;
          input.moveX = dx * k;
          input.moveZ = dy * k;
          if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx * k * 46}px), calc(-50% + ${dy * k * 46}px))`;
          const shouldSprint = Math.hypot(dx * k, dy * k) > 0.85;
          if (shouldSprint && !sprintActive.current) {
            sprintActive.current = true;
            virtualDown(key("sprint", "ShiftLeft"));
          } else if (!shouldSprint && sprintActive.current) {
            sprintActive.current = false;
            virtualUp(key("sprint", "ShiftLeft"));
          }
        }}
        onPointerUp={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          moveId.current = null;
          input.moveX = 0;
          input.moveZ = 0;
          if (!sprint) virtualUp(key("sprint", "ShiftLeft"));
          sprintActive.current = false;
          if (knob.current) knob.current.style.transform = "translate(-50%,-50%)";
        }}
        onPointerCancel={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          moveId.current = null;
          input.moveX = 0;
          input.moveZ = 0;
          sprintActive.current = false;
          if (knob.current) knob.current.style.transform = "translate(-50%,-50%)";
        }}
      >
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: stickSize * 0.5,
            height: stickSize * 0.5,
            transform: "translate(-50%,-50%)",
            borderColor: "rgba(255,255,255,0.85)",
            background: "rgba(255,255,255,0.22)",
          }}
        />
      </div>

      {/* right edge: build pieces */}
      <div
        className={`absolute ${pieceSide} z-30 flex flex-col gap-2`}
        style={{ top: compact ? 44 : "33%", transform: compact ? undefined : "translateY(-50%)" }}
      >
        {buildBtn("wall", "buildWall", "KeyQ")}
        {buildBtn("ramp", "buildRamp", "KeyV")}
        {buildBtn("floor", "buildFloor", "KeyC")}
        {buildBtn("roof", "buildRoof", "KeyF")}
        {/* material switch, Fortnite style */}
        <button
          type="button"
          aria-label="Material wechseln"
          className="pointer-events-auto flex flex-col items-center justify-center rounded-md border backdrop-blur-[2px]"
          style={{
            width: compact ? 40 : 48,
            height: compact ? 40 : 48,
            borderColor: MATS[material].color,
            background: "rgba(0,0,0,0.4)",
            color: MATS[material].color,
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            buzz();
            engine.cycleMaterial(1);
          }}
        >
          <span className="text-[10px] font-bold leading-none">{MATS[material].short}</span>
          <span className="text-[10px] font-bold leading-tight tabular-nums text-white">
            {matCounts[material] ?? 0}
          </span>
        </button>
      </div>

      {/* top right: aim + jump */}
      <div className={`absolute ${actionSide} z-30 flex gap-3`} style={{ bottom: compact ? fireSize + 30 : 176 }}>
        <RoundBtn
          size={btn}
          active={scoped}
          label="Zielen"
          onDown={() => {
            input.altDown = true;
            input.altPressed = true;
            if (!engine.buildMode && !engine.editMode && !WEAPONS[engine.weapon].melee) engine.scoped = true;
          }}
          onUp={() => {
            input.altDown = false;
            if (!settingsStore.get().adsToggle) engine.scoped = false;
          }}
        >
          <IconAim />
        </RoundBtn>
        <RoundBtn size={btn} label="Springen" onDown={() => virtualPress(key("jump", "Space"))}>
          <IconJump />
        </RoundBtn>
      </div>

      {/* bottom right cluster: fire, crouch */}
      <div className={`absolute bottom-6 ${actionSide} z-30 flex items-end gap-3`}>
        <RoundBtn
          size={fireSize}
          label="Schießen"
          onDown={() => {
            input.fireDown = true;
            input.firePressed = true;
          }}
          onUp={() => {
            input.fireDown = false;
          }}
        >
          <IconFire />
        </RoundBtn>
        <RoundBtn
          size={small}
          active={crouch}
          label="Ducken"
          onDown={() => {
            const k = key("crouch", "ControlLeft");
            if (crouch) {
              virtualUp(k);
              setCrouch(false);
            } else {
              virtualDown(k);
              setCrouch(true);
            }
          }}
        >
          <IconCrouch />
        </RoundBtn>
      </div>

      {/* center bottom: reload / edit / rotate + weapon slots */}
      <div
        className="absolute left-1/2 z-30 flex -translate-x-1/2 items-end justify-center gap-2"
        style={{ bottom: compact ? 8 : 96 }}
      >
        <RoundBtn size={small} label="Nachladen" onDown={() => virtualPress(key("reload", "KeyR"))}>
          <IconReload />
        </RoundBtn>
        <RoundBtn size={small} active={editMode} label="Bearbeiten" onDown={() => virtualPress(key("edit", "KeyG"))}>
          <IconEdit />
        </RoundBtn>
        <RoundBtn
          size={small}
          label="Drehen"
          onDown={() => {
            // reload and rotate share KeyR by default – rotate directly instead
            if (engine.buildMode) {
              engine.rotOffset = (engine.rotOffset + 1) % 4;
            } else {
              virtualPress(key("rotate", "KeyR"));
            }
          }}
        >
          <IconRotate />
        </RoundBtn>
        <RoundBtn
          size={small}
          active={sprint}
          label="Sprinten"
          onDown={() => {
            const k = key("sprint", "ShiftLeft");
            if (sprint) {
              virtualUp(k);
              setSprint(false);
            } else {
              virtualDown(k);
              setSprint(true);
            }
          }}
        >
          <span className="text-[11px] font-bold tracking-widest">RUN</span>
        </RoundBtn>
      </div>

      <div
        className="absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-2"
        style={{ bottom: compact ? small + 18 : 176 }}
      >
        <span className="mr-1 font-display text-sm font-bold tabular-nums text-white drop-shadow">
          {buildMode || editMode ? "BAU" : `${ammo}/${reserve}`}
        </span>
        {loadout.map((id, i) => {
          const spec = WEAPONS[id];
          const active = weapon === id && !buildMode && !editMode;
          return (
            <button
              key={id}
              type="button"
              aria-label={spec.name}
              className="pointer-events-auto flex h-10 w-14 items-center justify-center rounded-md border"
              style={{
                borderColor: active ? "var(--neon)" : "rgba(255,255,255,0.55)",
                background: active ? "rgba(80,230,255,0.28)" : "rgba(0,0,0,0.35)",
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                virtualPress(`Digit${i + 1}`);
              }}
            >
              <WeaponIcon id={id} color={active ? "#7ee0ff" : "#ffffff"} className="h-7 w-14" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

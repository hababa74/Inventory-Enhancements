import { useEffect } from "react";
import { BUILD_ORDER, MATS, MAT_ORDER, WEAPONS } from "../../game/constants";
import { useHud, useSettings } from "../../game/store";
import { engine } from "../../game/engine";
import { WeaponIcon } from "./WeaponIcon";
import { RankPopup } from "./RankPopup";
import { getEditShapeInfo } from "../../game/build";

function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[11px] font-semibold tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="relative h-3 w-52 overflow-hidden rounded-sm border border-border/70 bg-black/50">
        <div
          className="h-full transition-[width] duration-150 ease-out"
          style={{
            width: `${Math.max(0, (value / max) * 100)}%`,
            background: color,
            boxShadow: `0 0 14px ${color}`,
          }}
        />
      </div>
      <span className="w-9 text-right text-sm font-bold tabular-nums">{Math.round(value)}</span>
    </div>
  );
}

function Crosshair() {
  const buildMode = useHud((s) => s.buildMode);
  const editMode = useHud((s) => s.editMode);
  const scoped = useHud((s) => s.scoped);
  const weapon = useHud((s) => s.weapon);
  const drinkProgress = useHud((s) => s.drinkProgress);
  const lastHit = useHud((s) => s.lastHit);
  const lastHitStructure = useHud((s) => s.lastHitStructure);
  const lastHead = useHud((s) => s.lastHeadshot);
  const hitArmor = useHud((s) => s.lastHitArmor);
  const hitDist = useHud((s) => s.lastHitDist);

  const color = editMode ? "#48ff9e" : buildMode ? "#7ee0ff" : "#e9f6ff";
  if (scoped && WEAPONS[weapon].scope !== undefined && !buildMode && !editMode) return null;

  const head = lastHead >= lastHit;
  const hitColor = lastHitStructure
    ? "#ffd166"
    : head
      ? "#ff4d6d"
      : hitArmor
        ? "#6ec6ff"
        : "#ffffff";

  // Per-weapon crosshair configurations
  const isShotgun = weapon === "shotgun" || weapon === "tacshotgun";
  const isSniper = weapon === "sniper" || weapon === "heavy_sniper";
  const isBow = weapon === "bow" || weapon === "crossbow";
  const isRocket = weapon === "rocket";
  const isMinigun = weapon === "minigun";
  const isPickaxe = weapon === "pickaxe";
  const isShield = weapon === "mini_shield";

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {/* Mini shield drinking progress bar */}
      {drinkProgress > 0 && (
        <div className="absolute left-1/2 top-12 -translate-x-1/2 flex flex-col items-center pointer-events-none whitespace-nowrap">
          <div className="text-[11px] font-black tracking-widest text-[#38bdf8] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] animate-pulse">
            SHIELD TRINKEN... {Math.round(drinkProgress * 100)}%
          </div>
          <div className="mt-1 h-3 w-36 overflow-hidden rounded-full border-2 border-[#38bdf8] bg-black/80 shadow-[0_0_15px_rgba(56,189,248,0.7)] p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#bae6fd] transition-[width] duration-75"
              style={{ width: `${drinkProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Reticle */}
      <div className="relative h-12 w-12 flex items-center justify-center">
        {/* 1. Shotgun: Fortnite pump box brackets with center dot */}
        {isShotgun && !buildMode && !editMode ? (
          <div className="relative h-8 w-8">
            <div
              className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: color }}
            />
            {/* 4 corner brackets */}
            <div className="absolute left-0 top-0 h-2.5 w-[2px]" style={{ background: color }} />
            <div className="absolute left-0 top-0 h-[2px] w-2.5" style={{ background: color }} />
            <div className="absolute right-0 top-0 h-2.5 w-[2px]" style={{ background: color }} />
            <div className="absolute right-0 top-0 h-[2px] w-2.5" style={{ background: color }} />
            <div className="absolute left-0 bottom-0 h-2.5 w-[2px]" style={{ background: color }} />
            <div className="absolute left-0 bottom-0 h-[2px] w-2.5" style={{ background: color }} />
            <div
              className="absolute right-0 bottom-0 h-2.5 w-[2px]"
              style={{ background: color }}
            />
            <div
              className="absolute right-0 bottom-0 h-[2px] w-2.5"
              style={{ background: color }}
            />
          </div>
        ) : isBow && !buildMode && !editMode ? (
          /* 2. Bow & Crossbow: Archery circle reticle with center dot + chevron */
          <div className="relative h-10 w-10 flex items-center justify-center">
            <div
              className="absolute h-8 w-8 rounded-full border border-dashed"
              style={{ borderColor: color, borderWidth: 1.5 }}
            />
            <div className="absolute h-[3px] w-[3px] rounded-full" style={{ background: color }} />
            <div className="absolute bottom-1 h-1.5 w-[1.5px]" style={{ background: color }} />
          </div>
        ) : isRocket && !buildMode && !editMode ? (
          /* 3. Rocket: Target circle with outer cross ticks */
          <div className="relative h-10 w-10 flex items-center justify-center">
            <div
              className="absolute h-6 w-6 rounded-full border"
              style={{ borderColor: color, borderWidth: 1.5 }}
            />
            {[0, 90, 180, 270].map((r) => (
              <div
                key={r}
                className="absolute left-1/2 top-1/2 h-2.5 w-[2px] origin-center"
                style={{
                  background: color,
                  transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-14px)`,
                }}
              />
            ))}
          </div>
        ) : isMinigun && !buildMode && !editMode ? (
          /* 4. Minigun: Wide heavy circle with thick notches */
          <div className="relative h-12 w-12 flex items-center justify-center">
            <div
              className="absolute h-9 w-9 rounded-full border"
              style={{ borderColor: color, opacity: 0.6 }}
            />
            <div className="absolute h-[3px] w-[3px] rounded-full" style={{ background: color }} />
            {[0, 90, 180, 270].map((r) => (
              <div
                key={r}
                className="absolute left-1/2 top-1/2 h-3 w-[2.5px] origin-center"
                style={{
                  background: color,
                  transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-15px)`,
                }}
              />
            ))}
          </div>
        ) : isSniper && !buildMode && !editMode ? (
          /* 5. Snipers (Hipfire): Fine needle crosshair + precision dot */
          <div className="relative h-6 w-6 flex items-center justify-center">
            <div
              className="absolute h-[2.5px] w-[2.5px] rounded-full"
              style={{ background: "#ff4d6d" }}
            />
            {[0, 90, 180, 270].map((r) => (
              <div
                key={r}
                className="absolute left-1/2 top-1/2 h-2 w-[1px] origin-center"
                style={{
                  background: color,
                  transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-8px)`,
                }}
              />
            ))}
          </div>
        ) : isPickaxe && !buildMode && !editMode ? (
          /* 6. Pickaxe: Clean center dot */
          <div className="h-2 w-2 rounded-full border border-white/60 bg-[#48ff9e]/80" />
        ) : isShield && !buildMode && !editMode ? (
          /* 7. Mini Shield: Glowing potion crosshair */
          <div className="relative h-7 w-7 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-[#38bdf8] bg-[#0284c7]/20 shadow-[0_0_10px_#38bdf8]" />
            <div className="absolute h-1.5 w-1.5 rounded-full bg-[#38bdf8]" />
          </div>
        ) : (
          /* 8. Default & Assault Rifles / Pistols / SMGs / Build / Edit mode */
          <div className="relative h-8 w-8">
            <div
              className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: color }}
            />
            {[0, 90, 180, 270].map((r) => (
              <div
                key={r}
                className="absolute left-1/2 top-1/2 h-[9px] w-[2px] origin-center"
                style={{
                  background: color,
                  transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-9px)`,
                }}
              />
            ))}
          </div>
        )}

        {/* Hit Confirmation Markers */}
        {hitDist > 45 && (
          <div
            key={`far-${lastHit}`}
            className="absolute left-1/2 top-1/2 rounded-full border-2"
            style={{
              width: 46,
              height: 46,
              marginLeft: -23,
              marginTop: -23,
              borderColor: hitColor,
              animation: "hit-ring-out 0.5s ease-out forwards",
            }}
          />
        )}
        <div
          key={`hit-${lastHit}`}
          className="absolute inset-0"
          style={{ animation: "hit-ticks-out 0.22s ease-out forwards" }}
        >
          {[45, 135, 225, 315].map((r) => (
            <div
              key={r}
              className="absolute left-1/2 top-1/2 h-[10px] w-[2px]"
              style={{
                background: hitColor,
                transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-11px)`,
              }}
            />
          ))}
        </div>
        {lastHitStructure && (
          <div
            key={`build-hit-${lastHit}`}
            className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap text-[10px] font-black tracking-[0.22em] text-[#ffd166] drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
            style={{ animation: "rise-fade 0.55s ease-out forwards" }}
          >
            BUILD HIT
          </div>
        )}
      </div>
    </div>
  );
}

function DamageNumbers() {
  const numbers = useHud((s) => s.damageNumbers);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {numbers.map((d, i) => (
        <span
          key={d.id}
          className="absolute font-display text-xl font-bold"
          style={{
            left: `${((i * 37) % 90) - 20}px`,
            top: `${-30 - ((i * 23) % 40)}px`,
            color: d.head ? "#ff4d6d" : d.armor ? "#7cd4ff" : "#ffe08a",
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            animation: "rise-fade 0.9s ease-out forwards",
          }}
        >
          {d.amount}
          {d.head ? "!" : ""}
          {d.dist > 45 && (
            <span className="ml-1 align-super text-[10px] font-semibold opacity-80">
              {Math.round(d.dist)}m
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Fortnite-style interactive 3x3 blueprint HUD with real-time shape recognition and keybind badges. */
function EditGrid() {
  const editMode = useHud((s) => s.editMode);
  const editTiles = useHud((s) => s.editTiles);
  const editAimTile = useHud((s) => s.editAimTile);
  const editPieceType = useHud((s) => s.editPieceType);

  if (!editMode) return null;

  const shapeInfo = getEditShapeInfo(editPieceType ?? "wall", editTiles);
  const isValid = shapeInfo.valid;

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
      {/* Detected Shape Badge */}
      <div
        className="flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-black tracking-widest backdrop-blur-md shadow-lg"
        style={{
          borderColor: isValid ? "#38bdf8" : "#ef4444",
          background: isValid ? "rgba(2, 132, 199, 0.45)" : "rgba(239, 68, 68, 0.45)",
          color: isValid ? "#e0f2fe" : "#fee2e2",
          boxShadow: isValid
            ? "0 0 20px rgba(56, 189, 248, 0.4)"
            : "0 0 20px rgba(239, 68, 68, 0.5)",
          animation: isValid ? undefined : "pulse 1s infinite",
        }}
      >
        <span className="text-sm">{shapeInfo.icon}</span>
        <span className="font-display uppercase">{shapeInfo.name}</span>
      </div>

      {/* 3x3 Interactive Blueprint Grid Indicator */}
      <div
        className="relative grid grid-cols-3 gap-1.5 rounded-xl border-2 p-2 backdrop-blur-md shadow-2xl"
        style={{
          width: 120,
          height: 120,
          borderColor: isValid ? "rgba(56, 189, 248, 0.6)" : "rgba(239, 68, 68, 0.8)",
          background: "rgba(10, 25, 47, 0.75)",
          boxShadow: isValid
            ? "0 0 25px rgba(2, 132, 199, 0.35), inset 0 0 15px rgba(56, 189, 248, 0.2)"
            : "0 0 25px rgba(239, 68, 68, 0.45)",
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const isSolid = editTiles[i];
          const isAim = editAimTile === i;

          let bg = "bg-[#0284c7]/75 border-[#38bdf8]";
          let shadow = "0 0 8px rgba(56, 189, 248, 0.5)";

          if (!isValid) {
            bg = isSolid ? "bg-red-600/80 border-red-400" : "bg-red-950/40 border-red-900/40";
            shadow = "0 0 8px rgba(239, 68, 68, 0.6)";
          } else if (isAim) {
            bg = "bg-white border-white scale-105";
            shadow = "0 0 12px rgba(255, 255, 255, 0.9)";
          } else if (!isSolid) {
            bg = "bg-slate-950/60 border-cyan-800/30";
            shadow = "none";
          }

          return (
            <div
              key={i}
              className={`relative flex items-center justify-center rounded border transition-all duration-75 ${bg}`}
              style={{ boxShadow: shadow }}
            >
              {isAim && <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />}
            </div>
          );
        })}
      </div>

      {/* Control Hints / Action Badges */}
      <div className="flex items-center gap-4 text-[11px] font-semibold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 border border-white/20">
          <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            LMB
          </span>
          <span>Ziehen = Kacheln</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 border border-white/20">
          <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            Loslassen
          </span>
          <span>= Bestätigen</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 border border-white/20">
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            Mausrad / T
          </span>
          <span>= Reset</span>
        </div>
      </div>
    </div>
  );
}

/** Fortnite-style sniper scope: weapon-specific optics for Sniper, Heavy Sniper, Crossbow. */
function ScopeOverlay() {
  const scoped = useHud((s) => s.scoped);
  const weapon = useHud((s) => s.weapon);
  const buildMode = useHud((s) => s.buildMode);
  const editMode = useHud((s) => s.editMode);
  const hasScope = WEAPONS[weapon].scope !== undefined;
  if (!scoped || !hasScope || buildMode || editMode) return null;

  const isHeavy = weapon === "heavy_sniper";
  const isCrossbow = weapon === "crossbow";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* black surround with a round lens cut out */}
      <div
        className="absolute inset-0"
        style={{
          background: isHeavy
            ? "radial-gradient(circle at 50% 50%, rgba(10,25,12,0.15) calc(min(46vw,42vh) - 1px), rgba(0,0,0,0.98) min(46vw,42vh))"
            : "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) calc(min(46vw,42vh) - 1px), rgba(0,0,0,0.97) min(46vw,42vh))",
        }}
      />
      {/* lens vignette + ring */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "min(92vw,84vh)",
          height: "min(92vw,84vh)",
          border: isHeavy ? "3px solid #22c55e" : "2px solid rgba(0,0,0,0.9)",
          boxShadow: isHeavy
            ? "inset 0 0 100px 35px rgba(34,197,94,0.15), inset 0 0 50px 20px rgba(0,0,0,0.85)"
            : "inset 0 0 90px 30px rgba(0,0,0,0.75)",
        }}
      />

      {/* Heavy Sniper Tactical Overlays */}
      {isHeavy && (
        <>
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 font-display text-[11px] tracking-[0.3em] text-[#4ade80] opacity-80">
            [ RANGE: 1500M // CAL .50 BMG // 8.0X ]
          </div>
          <div className="absolute left-[28%] top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-widest text-[#4ade80]/60">
            ▲ ELEV: +0.02
          </div>
          <div className="absolute right-[28%] top-1/2 -translate-y-1/2 font-mono text-[9px] tracking-widest text-[#4ade80]/60">
            WIND: 0.00 M/S
          </div>
        </>
      )}

      {/* Crossbow Rangefinder Chevrons */}
      {isCrossbow && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 font-title text-[10px] tracking-[0.25em] text-[#f59e0b] opacity-75">
          BOLT BALLISTICS
        </div>
      )}

      {/* cross hairlines across the lens */}
      <div
        className={`absolute left-1/2 top-0 h-full w-px -translate-x-1/2 ${isHeavy ? "bg-[#22c55e]/70" : "bg-black/70"}`}
      />
      <div
        className={`absolute left-0 top-1/2 h-px w-full -translate-y-1/2 ${isHeavy ? "bg-[#22c55e]/70" : "bg-black/70"}`}
      />

      {/* Center Reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-28 w-28">
          {/* Center aiming dot */}
          <div
            className={`absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
              isHeavy
                ? "bg-[#4ade80] shadow-[0_0_8px_#4ade80]"
                : isCrossbow
                  ? "bg-[#f59e0b]"
                  : "bg-[#ff4d6d]"
            }`}
          />

          {/* 4 outer posts */}
          {[0, 90, 180, 270].map((r) => (
            <div
              key={r}
              className={`absolute left-1/2 top-1/2 h-5 w-[2px] origin-center ${isHeavy ? "bg-[#22c55e]" : "bg-black/85"}`}
              style={{ transform: `translate(-50%,-50%) rotate(${r}deg) translateY(-24px)` }}
            />
          ))}

          {/* Heavy Sniper Mil-Dots or Standard Range Hashes */}
          {isHeavy
            ? [-4, -3, -2, -1, 1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#4ade80]"
                  style={{ top: `calc(50% + ${n * 10}px)`, width: 3, height: 3 }}
                />
              ))
            : isCrossbow
              ? /* Crossbow ballistic drop chevrons */
                [1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="absolute left-1/2 -translate-x-1/2 border-b-2 border-r-2 border-[#f59e0b]"
                    style={{
                      top: `calc(50% + ${n * 14}px)`,
                      width: 8 + n * 4,
                      height: 8 + n * 4,
                      transform: "translateX(-50%) rotate(45deg)",
                      opacity: 0.85,
                    }}
                  />
                ))
              : /* Standard Sniper Hash Marks */
                [-3, -2, -1, 1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="absolute left-1/2 h-px bg-black/70"
                    style={{
                      top: `calc(50% + ${n * 9}px)`,
                      width: Math.abs(n) % 2 ? 10 : 16,
                      transform: "translateX(-50%)",
                    }}
                  />
                ))}
        </div>
      </div>
    </div>
  );
}

/** Target-dummy aim training: hit counter, round timer, best score. */
function AimTrainerPanel() {
  const at = useHud((s) => s.aimTrainer);
  if (!at.available) return null;
  const acc = at.shots > 0 ? Math.round((at.hits / at.shots) * 100) : 0;
  const secs = Math.ceil(at.timeLeft);
  return (
    <div className="panel clip-slant pointer-events-auto absolute left-1/2 top-40 w-56 -translate-x-1/2 px-4 py-3 text-center">
      <div className="text-[10px] tracking-[0.3em] text-muted-foreground">ZIELPUPPEN-MODUS</div>
      {at.active ? (
        <>
          <div className="mt-1 font-display text-4xl font-bold tabular-nums neon-text">
            {at.hits}
          </div>
          <div className="text-[11px] tracking-widest text-muted-foreground">
            TREFFER · {acc}% GENAU
          </div>
          <div
            className="mt-1 font-display text-2xl font-bold tabular-nums"
            style={{ color: secs <= 10 ? "var(--danger)" : undefined }}
          >
            {secs}s
          </div>
        </>
      ) : (
        <>
          {at.lastHits !== null && (
            <div className="mt-1 text-[11px] tracking-widest text-muted-foreground">
              LETZTE RUNDE: {at.lastHits} TREFFER
            </div>
          )}
          <div className="mt-0.5 text-[11px] tracking-widest text-muted-foreground">
            BESTWERT: {at.best}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => engine.toggleAimTrainer()}
        className="mt-2 w-full rounded-sm border border-[color:var(--neon)]/70 bg-[color:var(--neon)]/10 px-3 py-1.5 text-[11px] font-semibold tracking-widest text-[color:var(--neon)]"
      >
        {at.active ? "STOPP (H)" : "RUNDE STARTEN (H)"}
      </button>
    </div>
  );
}

const BUILD_HOTKEYS: Record<string, string> = { wall: "Q", ramp: "V", floor: "C", roof: "F" };

function TopTimer({ bestOf }: { bestOf: number }) {
  const roundTime = useHud((s) => s.roundTime);
  const mins = Math.floor(roundTime / 60);
  const secs = Math.floor(roundTime % 60);
  return (
    <div className="panel flex flex-col items-center px-5 py-1.5">
      <span className="font-display text-lg font-bold tabular-nums">
        {mins}:{secs.toString().padStart(2, "0")}
      </span>
      <span className="text-[10px] tracking-widest text-muted-foreground">
        FIRST TO {Math.ceil(bestOf / 2)}
      </span>
    </div>
  );
}

function StaminaBar() {
  const stamina = useHud((s) => s.stamina);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[11px] font-semibold tracking-widest text-muted-foreground">
        STAM
      </span>
      <div className="h-1.5 w-52 overflow-hidden rounded-sm bg-black/50">
        <div
          className="h-full transition-[width] duration-100"
          style={{ width: `${stamina}%`, background: "#ffd166" }}
        />
      </div>
      <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
        {Math.round(stamina)}
      </span>
    </div>
  );
}

function FpsCounter() {
  const showFps = useSettings((s) => s.showFps);
  const fps = useHud((s) => s.fps);
  if (!showFps) return null;
  return (
    <div className="absolute left-5 top-5 font-display text-xs tracking-widest text-muted-foreground">
      {fps} FPS
    </div>
  );
}

export function Hud() {
  const hp = useHud((s) => s.hp);
  const shield = useHud((s) => s.shield);
  const weapon = useHud((s) => s.weapon);
  const loadout = useHud((s) => s.loadout);
  const ammo = useHud((s) => s.ammo);
  const reserve = useHud((s) => s.reserve);
  const reloading = useHud((s) => s.reloading);
  const gameMode = useHud((s) => s.gameMode);
  const inStorm = useHud((s) => s.inStorm);
  const stormActive = useHud((s) => s.stormActive);
  const buildMode = useHud((s) => s.buildMode);
  const editMode = useHud((s) => s.editMode);
  const buildType = useHud((s) => s.buildType);
  const scoreYou = useHud((s) => s.scoreYou);
  const scoreEnemy = useHud((s) => s.scoreEnemy);
  const enemyHp = useHud((s) => s.enemyHp);
  const enemyShield = useHud((s) => s.enemyShield);
  const countdown = useHud((s) => s.countdown);
  const killFeed = useHud((s) => s.killFeed);
  const opponent = useHud((s) => s.opponentName);
  const botsAlive = useHud((s) => s.botsAlive);
  const botCount = useHud((s) => s.botCount);
  const bestOf = useSettings((s) => s.bestOf);

  const spec = WEAPONS[weapon];

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-body text-foreground">
      {/* top: scores + timer */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-4">
        <div className="panel clip-slant flex items-center gap-3 px-4 py-2">
          <span className="text-xs font-semibold tracking-widest text-[color:var(--neon-2)]">
            YOU
          </span>
          <span className="font-display text-2xl font-bold tabular-nums">{scoreYou}</span>
        </div>
        <TopTimer bestOf={bestOf} />
        <div className="panel clip-slant flex items-center gap-3 px-4 py-2">
          <span className="font-display text-2xl font-bold tabular-nums">{scoreEnemy}</span>
          <span className="text-xs font-semibold tracking-widest text-[color:var(--danger)]">
            {opponent}
          </span>
        </div>
      </div>

      {/* enemy health */}
      <div
        className={`absolute left-1/2 top-24 w-64 -translate-x-1/2 ${botCount === 0 ? "hidden" : ""}`}
      >
        <div className="mb-1 text-center text-[10px] tracking-[0.3em] text-muted-foreground">
          {botCount > 1 ? `GEGNER · ${botsAlive}/${botCount} AKTIV` : "OPPONENT"}
        </div>
        <div className="h-2 overflow-hidden rounded-sm border border-border/60 bg-black/50">
          <div className="h-full bg-[color:var(--danger)]" style={{ width: `${enemyHp}%` }} />
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm border border-border/40 bg-black/50">
          <div className="h-full bg-[color:var(--neon)]" style={{ width: `${enemyShield}%` }} />
        </div>
      </div>

      <Materials />
      <AimTrainerPanel />
      <ScopeOverlay />
      <Crosshair />
      <RankPopup />
      <DamageNumbers />
      <EditGrid />

      {/* countdown */}
      {countdown >= 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className="font-display text-8xl font-bold neon-text"
            style={{ animation: "pulse-ring 0.9s ease-out" }}
          >
            {countdown === 0 ? "GO" : countdown}
          </div>
        </div>
      )}

      {/* Storm warning */}
      {stormActive && inStorm && (
        <div
          className="pointer-events-none absolute inset-0 z-10 border-4"
          style={{
            borderColor: "#a855f7",
            boxShadow: "inset 0 0 60px rgba(168,85,247,0.4)",
            animation: "storm-pulse 1s ease-in-out infinite alternate",
          }}
        />
      )}
      {stormActive && (
        <div
          className="pointer-events-none absolute left-1/2 top-36 -translate-x-1/2 text-center"
          style={{ display: gameMode === "zonewars" ? "block" : "none" }}
        >
          {inStorm && (
            <div
              className="font-display text-sm font-bold tracking-widest"
              style={{ color: "#a855f7", textShadow: "0 0 10px #a855f7" }}
            >
              ⚠️ STORM – KEHRE ZURÜCK!
            </div>
          )}
        </div>
      )}

      {/* bottom left: vitals */}
      <div className="panel clip-slant absolute bottom-5 left-5 hidden space-y-1.5 px-4 py-3 [@media(pointer:fine)]:block">
        <Bar value={hp} max={100} color="#3dff9e" label="HP" />
        <Bar value={shield} max={100} color="#4ecbff" label="SHLD" />
        <StaminaBar />
      </div>

      {/* bottom right: weapon + ammo */}
      <div className="panel clip-slant absolute bottom-5 right-5 hidden px-4 py-3 text-right [@media(pointer:fine)]:block">
        {buildMode || editMode ? (
          <>
            <div className="font-display text-xl font-bold neon-text">
              {editMode ? "EDIT MODE" : "BUILD MODE"}
            </div>
            <div className="mt-2 flex justify-end gap-1.5">
              {BUILD_ORDER.map((b, i) => (
                <div
                  key={b}
                  className={`rounded-sm border px-2 py-1 text-[11px] uppercase tracking-wider ${
                    buildType === b && !editMode
                      ? "border-[color:var(--neon)] bg-[color:var(--neon)]/15 text-[color:var(--neon)]"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  {BUILD_HOTKEYS[b]} {b}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {editMode
                ? "LMB Kacheln • Loslassen bestätigt • T zurücksetzen • RMB abbrechen"
                : "LMB halten = Turbo-Bauen • R drehen • RMB zur Waffe"}
            </div>
          </>
        ) : (
          <>
            <div className="font-display text-lg font-bold" style={{ color: spec.color }}>
              {spec.name}
            </div>
            <div className="font-display text-4xl font-bold tabular-nums">
              {spec.melee ? "∞" : ammo}
              {!spec.melee && (
                <span className="ml-2 text-lg text-muted-foreground">/ {reserve}</span>
              )}
            </div>
            {reloading && (
              <div className="text-xs tracking-widest text-[color:var(--neon)]">RELOADING…</div>
            )}
            <div className="mt-2 flex justify-end gap-[3px]">
              {loadout.map((id, i) => {
                const w = WEAPONS[id];
                const active = weapon === id;
                return (
                  <div key={id} className="flex flex-col items-center">
                    <div
                      className="relative flex h-[58px] w-[64px] items-center justify-center overflow-hidden rounded-[3px]"
                      style={{
                        background: w.melee
                          ? "linear-gradient(160deg, #e6ebf0, #9aa4ae)"
                          : `linear-gradient(160deg, ${w.color}f2, ${w.color}99)`,
                        boxShadow: active
                          ? "0 0 0 3px #ffffff, 0 0 14px rgba(255,255,255,0.55)"
                          : "inset 0 0 0 1px rgba(0,0,0,0.35)",
                        opacity: active ? 1 : 0.82,
                      }}
                    >
                      <WeaponIcon
                        id={id}
                        className="h-11 w-[58px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                      />
                      <span className="absolute bottom-0.5 right-1 flex items-center gap-0.5 text-[11px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        {w.melee ? "∞" : active ? ammo : w.mag}
                        {!w.melee && (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                            <rect x="1" y="3" width="2" height="8" />
                            <rect x="5" y="1" width="2" height="10" />
                            <rect x="9" y="5" width="2" height="6" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <span
                      className={`mt-0.5 text-[10px] font-bold leading-none tabular-nums ${
                        active ? "text-white" : "text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* kill feed */}
      <div className="absolute right-5 top-5 space-y-1 text-right">
        {killFeed.map((k) => (
          <div key={k.id} className="panel inline-block px-3 py-1 text-xs">
            <span
              className={
                k.killer === "YOU" ? "text-[color:var(--neon-2)]" : "text-[color:var(--danger)]"
              }
            >
              {k.killer}
            </span>
            <span className="mx-2 text-muted-foreground">
              {k.headshot ? "⌖" : "»"} {k.weapon} »
            </span>
            <span className={k.victim === "YOU" ? "text-[color:var(--danger)]" : "text-foreground"}>
              {k.victim}
            </span>
          </div>
        ))}
      </div>

      <FpsCounter />

      {/* controls hint */}
      <div className="absolute bottom-5 left-1/2 hidden [@media(pointer:fine)]:block -translate-x-1/2 text-center text-[11px] tracking-wider text-muted-foreground/70">
        WASD bewegen • SPACE springen • SHIFT sprinten • STRG ducken • Q Wand • V Treppe • C Boden •
        F Dach • Z Material • G editieren • H Zielpuppen-Training • R nachladen • ESC Pause
      </div>
    </div>
  );
}

/** Fortnite-style material counters; the active material is highlighted. */
function Materials() {
  const material = useHud((s) => s.material);
  const wood = useHud((s) => s.matWood);
  const stone = useHud((s) => s.matStone);
  const metal = useHud((s) => s.matMetal);
  const counts: Record<string, number> = { wood, stone, metal };

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 [@media(pointer:fine)]:bottom-24">
      {MAT_ORDER.map((m) => {
        const active = m === material;
        return (
          <div
            key={m}
            className={`flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest backdrop-blur-[2px] ${
              active ? "bg-black/60" : "bg-black/30 opacity-70"
            }`}
            style={{
              borderColor: active ? MATS[m].color : "rgba(255,255,255,0.22)",
              color: MATS[m].color,
            }}
          >
            <span
              className="inline-block h-3 w-3 rounded-[2px]"
              style={{ background: MATS[m].color }}
            />
            <span className="tabular-nums text-foreground">{counts[m] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect, useRef, type ReactNode } from "react";
import { DEFAULT_KEYS, DEFAULT_SECONDARY_KEYS, KEY_LABELS, defaultSettings, updateSettings, useHud, useSettings, type Settings } from "../../game/store";
import { applyVolumes, audioSettings } from "../../game/audio";

export function NeonButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const base =
    "clip-slant relative w-full px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.18em] transition-all duration-150 disabled:opacity-40";
  const styles = {
    primary:
      "bg-[color:var(--neon)]/15 text-[color:var(--neon)] border border-[color:var(--neon)]/60 hover:bg-[color:var(--neon)]/30 hover:shadow-[0_0_28px_-6px_var(--neon)]",
    ghost: "bg-white/5 text-foreground border border-border hover:bg-white/10 hover:border-[color:var(--neon)]/50",
    danger:
      "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border border-[color:var(--danger)]/60 hover:bg-[color:var(--danger)]/30",
  } as const;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 sm:gap-6">
      <span className="text-sm tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-28 cursor-pointer appearance-none rounded bg-border accent-[color:var(--neon)] sm:w-44"
      />
      <span className="w-14 text-right text-sm tabular-nums text-foreground">{format ? format(value) : value}</span>
    </>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`h-6 w-12 rounded-full border transition-colors ${
        value ? "border-[color:var(--neon)] bg-[color:var(--neon)]/30" : "border-border bg-black/40"
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${value ? "translate-x-7" : "translate-x-1"}`}
      />
    </button>
  );
}

function SettingSelect<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        const opt = options.find((o) => String(o.value) === val);
        if (opt) onChange(opt.value);
      }}
      className="h-8 rounded-lg border border-white/20 bg-slate-900 px-3 text-xs font-semibold text-white shadow-inner transition hover:border-white/40 focus:border-yellow-400 focus:outline-none"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} className="bg-slate-900 text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function formatKey(code?: string): string {
  if (!code) return "None";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft" || code === "ShiftRight") return "SHIFT";
  if (code === "ControlLeft" || code === "ControlRight") return "CTRL";
  if (code === "AltLeft" || code === "AltRight") return "ALT";
  if (code === "ArrowUp") return "UP";
  if (code === "ArrowDown") return "DOWN";
  if (code === "ArrowLeft") return "LEFT";
  if (code === "ArrowRight") return "RIGHT";
  return code;
}

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "gameplay", label: "Gameplay" },
  { id: "keybinds", label: "Keybinds" },
  { id: "info", label: "Info & Extra" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

const KEYBIND_LIST: Array<{ id: string; label: string }> = [
  { id: "forward", label: "Forward" },
  { id: "back", label: "Backward" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "jump", label: "Jump" },
  { id: "sprint", label: "Sprint" },
  { id: "crouch", label: "Crouch" },
  { id: "reload", label: "Reload" },
  { id: "prevWeapon", label: "Previous Weapon" },
  { id: "buildWall", label: "Wall" },
  { id: "buildRamp", label: "Ramp" },
  { id: "buildFloor", label: "Floor" },
  { id: "buildRoof", label: "Roof" },
  { id: "build", label: "Toggle Build" },
  { id: "edit", label: "Edit" },
  { id: "resetEdit", label: "Reset Edit" },
  { id: "rotate", label: "Rotate Piece" },
  { id: "cycleMat", label: "Cycle Material" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings((x) => x);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [keySubtab, setKeySubtab] = useState<"keyboard" | "gamepad">("keyboard");
  const [binding, setBinding] = useState<{ action: string; slot: "primary" | "secondary" } | null>(null);
  const [notice, setNotice] = useState("");

  const pendingHandler = useRef<((e: KeyboardEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (pendingHandler.current) {
        window.removeEventListener("keydown", pendingHandler.current, true);
        pendingHandler.current = null;
      }
    };
  }, []);

  const bindKey = (action: string, slot: "primary" | "secondary") => {
    if (pendingHandler.current) {
      window.removeEventListener("keydown", pendingHandler.current, true);
      pendingHandler.current = null;
    }
    setBinding({ action, slot });

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        setBinding(null);
        pendingHandler.current = null;
        window.removeEventListener("keydown", handler, true);
        return;
      }

      if (slot === "primary") {
        updateSettings({ keys: { ...s.keys, [action]: e.code } });
      } else {
        updateSettings({ secondaryKeys: { ...(s.secondaryKeys || {}), [action]: e.code } });
      }

      setBinding(null);
      pendingHandler.current = null;
      window.removeEventListener("keydown", handler, true);
    };

    pendingHandler.current = handler;
    window.addEventListener("keydown", handler, true);
  };

  const clearBinding = (action: string) => {
    const nextSec = { ...(s.secondaryKeys || {}) };
    delete nextSec[action];
    updateSettings({ secondaryKeys: nextSec });
  };

  const setAudio = (patch: Partial<Settings>) => {
    updateSettings(patch);
    audioSettings.master = patch.master ?? audioSettings.master;
    audioSettings.sfx = patch.sfx ?? audioSettings.sfx;
    audioSettings.music = patch.music ?? audioSettings.music;
    applyVolumes();
  };

  const handleReset = () => {
    if (window.confirm("Reset all settings to default values?")) {
      updateSettings({ ...defaultSettings });
      setNotice("Settings have been reset to defaults.");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const handleExport = () => {
    try {
      const json = JSON.stringify(s, null, 2);
      void navigator.clipboard.writeText(json);
      setNotice("Settings copied to clipboard!");
      setTimeout(() => setNotice(""), 3000);
    } catch {
      setNotice("Failed to copy settings.");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const handleImport = () => {
    const input = window.prompt("Paste your settings JSON here:");
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === "object" && parsed !== null) {
        updateSettings(parsed);
        setNotice("Settings imported successfully!");
        setTimeout(() => setNotice(""), 3000);
      }
    } catch {
      setNotice("Invalid JSON format!");
      setTimeout(() => setNotice(""), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative flex h-[90vh] max-h-[760px] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0f172a]/95 text-white shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 py-3.5">
          {/* 4 Tabs */}
          <div className="flex items-center gap-2">
            {SETTINGS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 font-title text-sm font-black tracking-wider transition ${
                  tab === t.id
                    ? "bg-yellow-400 text-black shadow-md"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Action Buttons: RESET, EXPORT, IMPORT, X */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-red-600/90 px-3 py-1.5 font-title text-xs font-black tracking-wider text-white shadow transition hover:bg-red-500 active:scale-95"
            >
              RESET
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg bg-fuchsia-600/90 px-3 py-1.5 font-title text-xs font-black tracking-wider text-white shadow transition hover:bg-fuchsia-500 active:scale-95"
            >
              EXPORT
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="rounded-lg bg-fuchsia-600/90 px-3 py-1.5 font-title text-xs font-black tracking-wider text-white shadow transition hover:bg-fuchsia-500 active:scale-95"
            >
              IMPORT
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 font-bold text-white shadow transition hover:bg-red-500 active:scale-95"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notice Toast */}
        {notice && (
          <div className="border-b border-yellow-400/30 bg-yellow-400/20 px-6 py-1.5 text-center font-mono text-xs font-bold text-yellow-300">
            {notice}
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/20">
          {/* TAB 1: GENERAL */}
          {tab === "general" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Left Column */}
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-5">
                <Row label="Sensitivity">
                  <Slider
                    value={s.sensitivity}
                    min={0.05}
                    max={3.0}
                    step={0.01}
                    onChange={(v) => updateSettings({ sensitivity: v })}
                    format={(v) => v.toFixed(2)}
                  />
                </Row>
                <Row label="Graphics Preset">
                  <SettingSelect
                    value={s.graphicsPreset ?? "high"}
                    options={[
                      { label: "Low", value: "low" },
                      { label: "Medium", value: "medium" },
                      { label: "High", value: "high" },
                      { label: "Ultra", value: "ultra" },
                    ]}
                    onChange={(v) => updateSettings({ graphicsPreset: v })}
                  />
                </Row>
                <Row label="Language">
                  <SettingSelect
                    value={s.language ?? "en"}
                    options={[
                      { label: "English", value: "en" },
                      { label: "Deutsch", value: "de" },
                      { label: "Español", value: "es" },
                      { label: "Français", value: "fr" },
                    ]}
                    onChange={(v) => updateSettings({ language: v })}
                  />
                </Row>
                <Row label="Region">
                  <SettingSelect
                    value={s.region ?? "auto"}
                    options={[
                      { label: "Auto (Fastest)", value: "auto" },
                      { label: "Europe (Frankfurt)", value: "eu2" },
                      { label: "North America (East)", value: "us-east" },
                      { label: "North America (West)", value: "us-west" },
                      { label: "Asia (Tokyo)", value: "asia" },
                    ]}
                    onChange={(v) => updateSettings({ region: v })}
                  />
                </Row>
                <Row label="Mouse Aim Sens">
                  <Slider
                    value={s.aimSensitivity ?? 1.0}
                    min={0.1}
                    max={2.5}
                    step={0.05}
                    onChange={(v) => updateSettings({ aimSensitivity: v })}
                    format={(v) => `${v.toFixed(2)}x`}
                  />
                </Row>
                <Row label="FOV">
                  <Slider
                    value={s.fov}
                    min={60}
                    max={110}
                    step={1}
                    onChange={(v) => updateSettings({ fov: v })}
                  />
                </Row>
                <Row label="Frame Cap">
                  <div className="flex items-center gap-3">
                    <Toggle
                      value={s.allowFrameCap ?? false}
                      onChange={(v) => updateSettings({ allowFrameCap: v })}
                    />
                    {s.allowFrameCap && (
                      <Slider
                        value={s.frameCap ?? 144}
                        min={30}
                        max={360}
                        step={10}
                        onChange={(v) => updateSettings({ frameCap: v })}
                        format={(v) => `${v} FPS`}
                      />
                    )}
                  </div>
                </Row>
                <Row label="Master Volume">
                  <Slider
                    value={s.master}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setAudio({ master: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Music Volume">
                  <Slider
                    value={s.music}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setAudio({ music: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-5">
                <Row label="Anti-Aliasing">
                  <SettingSelect
                    value={s.antiAliasing ?? 1}
                    options={[
                      { label: "Off", value: 0 },
                      { label: "FXAA (Low)", value: 1 },
                      { label: "SMAA (High)", value: 2 },
                    ]}
                    onChange={(v) => updateSettings({ antiAliasing: v })}
                  />
                </Row>
                <Row label="Texture Quality">
                  <SettingSelect
                    value={s.textureQuality ?? 1}
                    options={[
                      { label: "Low", value: 0 },
                      { label: "Medium", value: 1 },
                      { label: "High", value: 2 },
                    ]}
                    onChange={(v) => updateSettings({ textureQuality: v })}
                  />
                </Row>
                <Row label="HUD Scale">
                  <Slider
                    value={s.hudScale ?? 1.0}
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    onChange={(v) => updateSettings({ hudScale: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Resolution Scale">
                  <Slider
                    value={s.resolutionScale ?? 1.0}
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    onChange={(v) => updateSettings({ resolutionScale: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Speed Lines">
                  <Toggle
                    value={s.showSpeedLines ?? false}
                    onChange={(v) => updateSettings({ showSpeedLines: v })}
                  />
                </Row>
                <Row label="Shadows">
                  <Toggle
                    value={s.shadows}
                    onChange={(v) => updateSettings({ shadows: v })}
                  />
                </Row>
                <Row label="UI Animations">
                  <Toggle
                    value={s.enableUIAnimations ?? true}
                    onChange={(v) => updateSettings({ enableUIAnimations: v })}
                  />
                </Row>
                <Row label="Show FPS Counter">
                  <Toggle
                    value={s.showFps}
                    onChange={(v) => updateSettings({ showFps: v })}
                  />
                </Row>
                <Row label="Third-Person Camera">
                  <Toggle
                    value={s.thirdPerson}
                    onChange={(v) => updateSettings({ thirdPerson: v })}
                  />
                </Row>
              </div>
            </div>
          )}

          {/* TAB 2: GAMEPLAY */}
          {tab === "gameplay" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Left Column: Combat & Building Options */}
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-5">
                <div className="border-b border-white/10 pb-1 font-title text-xs font-bold uppercase tracking-wider text-yellow-400">
                  Combat & Building Mechanics
                </div>
                <Row label="Auto Confirm Edits">
                  <Toggle
                    value={s.autoConfirmEdit ?? false}
                    onChange={(v) => updateSettings({ autoConfirmEdit: v })}
                  />
                </Row>
                <Row label="Turbo Building">
                  <Toggle
                    value={s.turboBuild ?? true}
                    onChange={(v) => updateSettings({ turboBuild: v })}
                  />
                </Row>
                <Row label="Crosshair Thickness">
                  <Slider
                    value={s.crosshairThickness ?? 2}
                    min={1}
                    max={5}
                    step={0.5}
                    onChange={(v) => updateSettings({ crosshairThickness: v })}
                    format={(v) => `${v.toFixed(1)}px`}
                  />
                </Row>
                <Row label="Weapon Bobbing">
                  <Slider
                    value={s.weaponBobbing ?? 0.5}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => updateSettings({ weaponBobbing: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Hands Height">
                  <Slider
                    value={s.handsModelHeight ?? 0}
                    min={-50}
                    max={50}
                    step={5}
                    onChange={(v) => updateSettings({ handsModelHeight: v })}
                    format={(v) => `${v > 0 ? "+" : ""}${v}`}
                  />
                </Row>
                <Row label="Weapon Leaning">
                  <Slider
                    value={s.weaponLeaning ?? 0.5}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => updateSettings({ weaponLeaning: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Camera Animation">
                  <Toggle
                    value={s.cameraAnimation ?? true}
                    onChange={(v) => updateSettings({ cameraAnimation: v })}
                  />
                </Row>
                <Row label="Auto-Sprint">
                  <Toggle
                    value={s.autoSprint ?? false}
                    onChange={(v) => updateSettings({ autoSprint: v })}
                  />
                </Row>
                <Row label="SFX Volume">
                  <Slider
                    value={s.sfx}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setAudio({ sfx: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Row>
                <Row label="Muzzle Flash">
                  <Toggle
                    value={s.enableMuzzleFlash ?? true}
                    onChange={(v) => updateSettings({ enableMuzzleFlash: v })}
                  />
                </Row>
                <Row label="Auto Pickup Weapons">
                  <Toggle
                    value={s.autoPickupWeapons ?? true}
                    onChange={(v) => updateSettings({ autoPickupWeapons: v })}
                  />
                </Row>
                <Row label="Hitmark Numbers">
                  <Toggle
                    value={s.showHitmarkNumbers ?? true}
                    onChange={(v) => updateSettings({ showHitmarkNumbers: v })}
                  />
                </Row>
              </div>

              {/* Right Column: UI Visibility & Controls */}
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900/40 p-5">
                <div className="border-b border-white/10 pb-1 font-title text-xs font-bold uppercase tracking-wider text-yellow-400">
                  HUD Toggles & Aiming
                </div>
                <Row label="Ammo UI">
                  <Toggle
                    value={s.showAmmoUI ?? true}
                    onChange={(v) => updateSettings({ showAmmoUI: v })}
                  />
                </Row>
                <Row label="Health UI">
                  <Toggle
                    value={s.showHealthUI ?? true}
                    onChange={(v) => updateSettings({ showHealthUI: v })}
                  />
                </Row>
                <Row label="Weapons UI">
                  <Toggle
                    value={s.showWeaponsUI ?? true}
                    onChange={(v) => updateSettings({ showWeaponsUI: v })}
                  />
                </Row>
                <Row label="Movement Speed Text">
                  <Toggle
                    value={s.showMovementSpeedText ?? false}
                    onChange={(v) => updateSettings({ showMovementSpeedText: v })}
                  />
                </Row>
                <Row label="Match Stats UI">
                  <Toggle
                    value={s.showMatchStats ?? true}
                    onChange={(v) => updateSettings({ showMatchStats: v })}
                  />
                </Row>
                <Row label="Chat UI">
                  <Toggle
                    value={s.showChat ?? true}
                    onChange={(v) => updateSettings({ showChat: v })}
                  />
                </Row>
                <Row label="Crosshair Dot">
                  <Toggle
                    value={s.showCrosshairDot ?? true}
                    onChange={(v) => updateSettings({ showCrosshairDot: v })}
                  />
                </Row>
                <Row label="Dynamic Crosshair">
                  <Toggle
                    value={s.dynamicCrosshair ?? true}
                    onChange={(v) => updateSettings({ dynamicCrosshair: v })}
                  />
                </Row>
                <Row label="Invert Mouse X">
                  <Toggle
                    value={s.invertX ?? false}
                    onChange={(v) => updateSettings({ invertX: v })}
                  />
                </Row>
                <Row label="Invert Mouse Y">
                  <Toggle
                    value={s.invertY}
                    onChange={(v) => updateSettings({ invertY: v })}
                  />
                </Row>
              </div>
            </div>
          )}

          {/* TAB 3: KEYBINDS */}
          {tab === "keybinds" && (
            <div className="flex flex-col gap-4">
              {/* Keyboard vs Gamepad subtab */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <button
                  type="button"
                  onClick={() => setKeySubtab("keyboard")}
                  className={`rounded-lg px-4 py-1.5 font-title text-xs font-black tracking-wider transition ${
                    keySubtab === "keyboard"
                      ? "bg-yellow-400 text-black shadow"
                      : "bg-white/5 text-white/70 hover:text-white"
                  }`}
                >
                  KEYBOARD
                </button>
                <button
                  type="button"
                  onClick={() => setKeySubtab("gamepad")}
                  className={`rounded-lg px-4 py-1.5 font-title text-xs font-black tracking-wider transition ${
                    keySubtab === "gamepad"
                      ? "bg-yellow-400 text-black shadow"
                      : "bg-white/5 text-white/70 hover:text-white"
                  }`}
                >
                  GAMEPAD
                </button>
              </div>

              {keySubtab === "keyboard" ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 items-center border-b border-white/10 bg-slate-950/60 px-4 py-2.5 font-title text-[11px] font-black tracking-wider text-white/60">
                    <div className="col-span-5">ACTION</div>
                    <div className="col-span-3 text-center">PRIMARY</div>
                    <div className="col-span-3 text-center">SECONDARY</div>
                    <div className="col-span-1 text-right">CLEAR</div>
                  </div>

                  {/* Action Rows */}
                  <div className="divide-y divide-white/5">
                    {KEYBIND_LIST.map((action) => {
                      const prim = s.keys[action.id];
                      const sec = s.secondaryKeys?.[action.id];
                      const isBindingPrim = binding?.action === action.id && binding?.slot === "primary";
                      const isBindingSec = binding?.action === action.id && binding?.slot === "secondary";

                      return (
                        <div
                          key={action.id}
                          className="grid grid-cols-12 items-center px-4 py-2 hover:bg-white/[0.03]"
                        >
                          <div className="col-span-5 font-title text-xs font-bold text-white/90">
                            {action.label}
                          </div>

                          {/* Primary Box */}
                          <div className="col-span-3 px-1">
                            <button
                              type="button"
                              onClick={() => bindKey(action.id, "primary")}
                              className={`w-full rounded-lg border py-1.5 font-mono text-xs font-bold uppercase transition ${
                                isBindingPrim
                                  ? "border-yellow-400 bg-yellow-400/20 text-yellow-300 animate-pulse"
                                  : "border-white/15 bg-slate-800/80 text-white hover:border-white/40"
                              }`}
                            >
                              {isBindingPrim ? "PRESS KEY..." : formatKey(prim)}
                            </button>
                          </div>

                          {/* Secondary Box */}
                          <div className="col-span-3 px-1">
                            <button
                              type="button"
                              onClick={() => bindKey(action.id, "secondary")}
                              className={`w-full rounded-lg border py-1.5 font-mono text-xs font-bold uppercase transition ${
                                isBindingSec
                                  ? "border-yellow-400 bg-yellow-400/20 text-yellow-300 animate-pulse"
                                  : "border-white/15 bg-slate-800/80 text-white/80 hover:border-white/40"
                              }`}
                            >
                              {isBindingSec ? "PRESS KEY..." : formatKey(sec)}
                            </button>
                          </div>

                          {/* Red X Clear Button */}
                          <div className="col-span-1 text-right">
                            <button
                              type="button"
                              onClick={() => clearBinding(action.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded bg-red-600/80 text-xs font-bold text-white transition hover:bg-red-500 active:scale-95"
                              title="Clear secondary binding"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center">
                  <div className="text-4xl">🎮</div>
                  <div className="mt-3 font-title text-base font-bold text-white">
                    Gamepad Connected
                  </div>
                  <p className="mt-1 text-xs text-white/60">
                    Gamepad sticks & triggers are automatically mapped. Default layout matches Xbox & PlayStation controllers.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INFO & EXTRA */}
          {tab === "info" && (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-5">
                <div className="font-title text-lg font-black text-yellow-400">
                  2V2.IO ARENA // V1.4.0
                </div>
                <p className="mt-1 text-xs text-white/70">
                  Competitive high-speed 3D tactical shooter inspired by 2v2.io and 1v1.lol. Features 15 unique 3D weapons, modular build & edit grid mechanics, competitive ranks, and low-latency physics.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                  <div className="font-title text-xs font-bold uppercase tracking-wider text-white/80">
                    Controls Quick-Guide
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-white/60">
                    <li><strong className="text-white">WASD:</strong> Movement</li>
                    <li><strong className="text-white">SPACE / SHIFT:</strong> Jump / Sprint</li>
                    <li><strong className="text-white">LMB / RMB:</strong> Shoot / Scope</li>
                    <li><strong className="text-white">Q / V / C / F:</strong> Wall, Ramp, Floor, Roof</li>
                    <li><strong className="text-white">G / T:</strong> Edit piece / Reset edit</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                  <div className="font-title text-xs font-bold uppercase tracking-wider text-white/80">
                    Data Management
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    If you experience any settings sync issues, you can clear all locally cached settings and loadouts.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Clear all local storage and reload?")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="mt-4 rounded-lg bg-red-600/90 px-4 py-2 font-title text-xs font-black tracking-wider text-white transition hover:bg-red-500"
                  >
                    CLEAR LOCAL CACHE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function EndScreen({
  onRematch,
  onMenu,
  summary,
}: {
  onRematch: () => void;
  onMenu: () => void;
  summary?: { mmrBefore: number; mmrAfter: number; xp: number; coins: number } | null;
}) {
  const result = useHud((s) => s.matchResult);
  const you = useHud((s) => s.scoreYou);
  const enemy = useHud((s) => s.scoreEnemy);
  const win = result === "win";
  const delta = summary ? summary.mmrAfter - summary.mmrBefore : 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Victory Royale Sunburst Rays & Confetti */}
      {win && (
        <>
          <div
            className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 overflow-visible opacity-30"
            style={{ width: 600, height: 600 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg at 50% 50%, #ffd700 0deg, transparent 15deg, #ff8c00 30deg, transparent 45deg, #ffd700 60deg, transparent 75deg, #ff8c00 90deg, transparent 105deg, #ffd700 120deg, transparent 135deg, #ff8c00 150deg, transparent 165deg, #ffd700 180deg, transparent 195deg, #ff8c00 210deg, transparent 225deg, #ffd700 240deg, transparent 255deg, #ff8c00 270deg, transparent 285deg, #ffd700 300deg, transparent 315deg, #ff8c00 330deg, transparent 345deg, #ffd700 360deg)",
                animation: "victory-ray-spin 25s linear infinite",
              }}
            />
          </div>
          {/* Confetti particles */}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * Math.PI * 2;
              const dist = 140 + (i % 5) * 35;
              const tx = Math.cos(angle) * dist;
              const ty = Math.sin(angle) * dist;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-12 rounded-sm"
                  style={{
                    width: 6 + (i % 3) * 3,
                    height: 8 + (i % 4) * 3,
                    background: ["#ffd700", "#ff4d6d", "#48ff9e", "#00f0ff", "#ff9f1c"][i % 5],
                    "--tx": `${tx}px`,
                    "--ty": `${ty}px`,
                    "--tr": `${(i * 45)}deg`,
                    animation: `victory-confetti 1.2s cubic-bezier(0.15,0.85,0.35,1.2) ${(i * 0.04)}s forwards`,
                  } as React.CSSProperties}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Main Container */}
      <div
        className="panel relative z-10 w-[490px] max-w-[94vw] p-8 text-center"
        style={{
          boxShadow: win
            ? "0 0 50px rgba(255,215,0,0.35), 0 0 100px rgba(255,140,0,0.2)"
            : "0 0 50px rgba(255,77,109,0.35)",
          border: win ? "2px solid #ffd700" : "2px solid var(--danger)",
        }}
      >
        {win ? (
          <div className="relative mb-2 overflow-hidden py-2" style={{ animation: "victory-banner-pop 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }}>
            {/* Golden Shine sweep */}
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                animation: "victory-shine-sweep 2.5s ease-in-out infinite",
              }}
            />
            <div
              className="font-display text-5xl sm:text-6xl font-black tracking-widest text-transparent"
              style={{
                backgroundImage: "linear-gradient(180deg, #ffffff 0%, #ffe600 35%, #ff8800 85%, #d95300 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 4px 14px rgba(255,150,0,0.85)) drop-shadow(0 0 35px rgba(255,215,0,0.6))",
              }}
            >
              #1 VICTORY
            </div>
            <div
              className="mt-0.5 font-display text-2xl sm:text-3xl font-black tracking-[0.25em] text-[#ffcc00]"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8), 0 0 20px #ff9900" }}
            >
              ROYALE
            </div>
          </div>
        ) : (
          <h1
            className="font-display text-6xl font-bold"
            style={{ color: "var(--danger)", textShadow: "0 0 40px var(--danger)" }}
          >
            DEFEAT
          </h1>
        )}

        <p className="mt-2 font-display text-3xl tabular-nums">
          <span className={win ? "text-yellow-400 font-bold" : "text-white"}>{you}</span>
          <span className="mx-3 text-muted-foreground">:</span>
          <span className={!win ? "text-red-400 font-bold" : "text-white"}>{enemy}</span>
        </p>

        {summary && (
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="clip-chamfer border border-border/60 p-3 bg-black/40">
              <div className="text-[10px] tracking-widest text-muted-foreground">WERTUNG</div>
              <div className="font-title text-lg tabular-nums">
                {summary.mmrAfter}{" "}
                <span style={{ color: delta >= 0 ? "var(--neon-2)" : "var(--danger)" }}>
                  ({delta >= 0 ? "+" : ""}
                  {delta})
                </span>
              </div>
            </div>
            <div className="clip-chamfer border border-border/60 p-3 bg-black/40">
              <div className="text-[10px] tracking-widest text-muted-foreground">BATTLE PASS</div>
              <div className="font-title text-lg tabular-nums text-[color:var(--neon)]">
                +{summary.xp.toLocaleString("de-DE")} XP
              </div>
            </div>
            <div className="clip-chamfer col-span-2 border border-border/60 p-3 bg-black/40">
              <div className="text-[10px] tracking-widest text-muted-foreground">COINS</div>
              <div
                className="font-title text-lg tabular-nums"
                style={{ color: summary.coins >= 0 ? "var(--neon)" : "var(--danger)" }}
              >
                {summary.coins >= 0 ? "+" : ""}
                {summary.coins.toLocaleString("de-DE")} ◆
              </div>
            </div>
          </div>
        )}

        <div className="mt-7 space-y-2.5">
          <NeonButton onClick={onRematch} variant={win ? "primary" : "primary"}>
            {win ? "🏆 Nochmal Spielen" : "Rematch"}
          </NeonButton>
          <NeonButton variant="ghost" onClick={onMenu}>
            Hauptmenü
          </NeonButton>
        </div>
      </div>
    </div>
  );
}


export function RoundBanner() {
  const result = useHud((s) => s.roundResult);
  const you = useHud((s) => s.scoreYou);
  const enemy = useHud((s) => s.scoreEnemy);
  if (!result) return null;
  const win = result === "win";
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-center">
      <div
        className="font-display text-5xl font-bold"
        style={{ color: win ? "var(--neon-2)" : "var(--danger)", textShadow: `0 0 34px ${win ? "var(--neon-2)" : "var(--danger)"}` }}
      >
        {win ? "RUNDE GEWONNEN" : "RUNDE VERLOREN"}
      </div>
      <div className="mt-2 font-display text-2xl tabular-nums text-foreground/80">
        {you} : {enemy}
      </div>
      <div className="mt-4 text-sm tracking-widest text-muted-foreground">Nächste Runde startet…</div>
    </div>
  );
}

import { useState } from "react";
import { GAME_MODES, type GameMode, type GameModeInfo } from "../../game/constants";
import { useSettings, updateSettings } from "../../game/store";

interface GameModeModalProps {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: GameMode, offline: boolean) => void;
}

export function GameModeModal({ open, onClose, onSelectMode }: GameModeModalProps) {
  const currentMode = useSettings((s) => s.gameMode);
  const wins = useSettings((s) => s.wins);
  const [selected, setSelected] = useState<GameMode>(currentMode);
  const [playOffline, setPlayOffline] = useState(true);

  if (!open) return null;

  const modeList = Object.values(GAME_MODES) as GameModeInfo[];
  const selectedInfo = GAME_MODES[selected] ?? GAME_MODES.duel;

  const handleAccept = () => {
    updateSettings({ gameMode: selected, unlimitedMats: selectedInfo.unlimitedMats });
    onSelectMode(selected, playOffline);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] max-h-[720px] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-white/20 bg-[#0f172a]/95 text-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-title text-2xl font-black tracking-widest text-white/90 drop-shadow">
            CHOOSE GAME MODE
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 font-bold text-white transition hover:bg-red-500 hover:scale-105"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
          {/* Left Grid Area */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/20">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modeList.map((m) => {
                const isSelected = selected === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelected(m.id)}
                    className={`group relative aspect-[16/10] cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-150 ${
                      isSelected
                        ? "border-yellow-400 ring-4 ring-yellow-400/40 scale-[1.02] shadow-[0_0_25px_rgba(250,204,21,0.5)]"
                        : "border-white/15 opacity-85 hover:opacity-100 hover:border-white/40"
                    }`}
                  >
                    {/* Background Artwork */}
                    <img
                      src={m.image}
                      alt={m.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />

                    {/* Top Right Badges */}
                    <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-black/75 px-2 py-0.5 text-[11px] font-black tracking-wider text-amber-300 border border-amber-500/40 backdrop-blur-sm">
                      <span>🏆</span>
                      <span>{wins} WINS</span>
                    </div>

                    {/* Bottom Left Mode Labels */}
                    <div className="absolute bottom-2 left-3">
                      <div className="font-title text-xl font-black leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {m.badge}
                      </div>
                      <div className="text-[10px] font-bold tracking-widest text-cyan-300 drop-shadow">
                        {m.sub}
                      </div>
                    </div>

                    {/* Bottom Right Rank/Unranked Badge */}
                    <div className="absolute bottom-2 right-3 flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/20 text-xs font-black text-white/90">
                        ?
                      </div>
                      <div className="text-[9px] font-semibold text-white/70">Unranked</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Detail Sidebar */}
          <div className="flex w-full flex-col justify-between border-t border-white/10 bg-[#090d16] p-6 md:w-[320px] md:border-l md:border-t-0">
            <div>
              <h3 className="font-title text-3xl font-black tracking-wide text-white">
                {selectedInfo.badge}
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                {selectedInfo.desc}
              </p>

              {/* Play Offline Checkbox */}
              <label className="mt-6 flex cursor-pointer items-center gap-3 select-none">
                <input
                  type="checkbox"
                  checked={playOffline}
                  onChange={(e) => setPlayOffline(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-black/60 text-yellow-400 focus:ring-yellow-400"
                />
                <span className="text-xs font-bold tracking-wider text-white">Play Offline (Bots)</span>
              </label>

              {/* Thumbnail Preview */}
              <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-lg border border-white/20 bg-black/50">
                <img
                  src={selectedInfo.image}
                  alt={selectedInfo.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 text-[10px] font-bold tracking-wider text-white/80 bg-black/60 px-2 py-0.5 rounded">
                  {selectedInfo.name}
                </div>
              </div>
            </div>

            {/* Accept Action Button */}
            <button
              type="button"
              onClick={handleAccept}
              className="mt-6 w-full rounded-md bg-yellow-400 py-3.5 font-title text-2xl font-black tracking-wider text-slate-950 shadow-[0_0_25px_rgba(250,204,21,0.5)] transition hover:bg-yellow-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              ACCEPT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

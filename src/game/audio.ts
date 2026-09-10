/**
 * Fully procedural WebAudio SFX — no external assets, zero load time.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicNodes: { osc: OscillatorNode[]; lfo?: OscillatorNode } | null = null;
let noiseBuffer: AudioBuffer | null = null;

// SFX throttle timestamps: prevents audio clipping from too many simultaneous nodes
const sfxLastPlayed: Record<string, number> = {};
const SFX_THROTTLE_MS = 20; // minimum ms between same sound type

function throttled(key: string): boolean {
  const now = Date.now();
  if ((now - (sfxLastPlayed[key] ?? 0)) < SFX_THROTTLE_MS) return true;
  sfxLastPlayed[key] = now;
  return false;
}

export const audioSettings = { master: 0.7, sfx: 0.8, music: 0.35 };

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = audioSettings.master;

  // DynamicsCompressor prevents clipping and harsh digital distortion during heavy fire (minigun, explosions, SMG)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-6, ctx.currentTime);
  compressor.knee.setValueAtTime(12, ctx.currentTime);
  compressor.ratio.setValueAtTime(8, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.2, ctx.currentTime);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = audioSettings.sfx;
  sfxGain.connect(master);
  musicGain = ctx.createGain();
  musicGain.gain.value = audioSettings.music * 0.25;
  musicGain.connect(master);

  const len = Math.floor(ctx.sampleRate * 1.2);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function applyVolumes() {
  if (!master || !sfxGain || !musicGain) return;
  master.gain.value = audioSettings.master;
  sfxGain.gain.value = audioSettings.sfx;
  musicGain.gain.value = audioSettings.music * 0.25;
}

/** Updates the Web Audio listener position and orientation every frame.
 *  Call this from the engine with the local player's position and yaw.
 */
export function setAudioListener(x: number, y: number, z: number, yaw: number): void {
  if (!ctx) return;
  const listener = ctx.listener;
  // Position
  if (listener.positionX) {
    listener.positionX.setValueAtTime(x, ctx.currentTime);
    listener.positionY.setValueAtTime(y, ctx.currentTime);
    listener.positionZ.setValueAtTime(z, ctx.currentTime);
    // Forward vector from yaw (looking direction)
    listener.forwardX.setValueAtTime(-Math.sin(yaw), ctx.currentTime);
    listener.forwardY.setValueAtTime(0, ctx.currentTime);
    listener.forwardZ.setValueAtTime(-Math.cos(yaw), ctx.currentTime);
    // Up vector
    listener.upX.setValueAtTime(0, ctx.currentTime);
    listener.upY.setValueAtTime(1, ctx.currentTime);
    listener.upZ.setValueAtTime(0, ctx.currentTime);
  } else {
    // Fallback for older browsers
    listener.setPosition?.(x, y, z);
    listener.setOrientation?.(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0);
  }
}

/** Creates a PannerNode at the given 3D position and routes the provided
 *  sound-generating callback through it.
 *  The sound is positioned in 3D space relative to the listener.
 */
export function spatialSfx(
  fn: () => void,
  sx: number,
  sy: number,
  sz: number,
  maxDist = 35,
): void {
  if (!ctx || !sfxGain) return;

  // Create a panner node
  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 3;
  panner.maxDistance = maxDist;
  panner.rolloffFactor = 1.8;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 0;
  panner.coneOuterGain = 0;

  if (panner.positionX) {
    panner.positionX.setValueAtTime(sx, ctx.currentTime);
    panner.positionY.setValueAtTime(sy, ctx.currentTime);
    panner.positionZ.setValueAtTime(sz, ctx.currentTime);
  } else {
    panner.setPosition?.(sx, sy, sz);
  }

  // Temporarily redirect sfxGain output through panner
  // We create an intermediate gain node so existing sfx functions work unmodified
  const spatialGain = ctx.createGain();
  spatialGain.gain.value = 1;
  spatialGain.connect(panner);
  panner.connect(sfxGain);

  // Swap sfxGain target temporarily
  const origSfxGain = sfxGain;
  sfxGain = spatialGain as unknown as GainNode;
  try {
    fn();
  } finally {
    sfxGain = origSfxGain;
  }

  // Auto-cleanup after the longest possible sound duration (1.5s)
  setTimeout(() => {
    try {
      spatialGain.disconnect();
      panner.disconnect();
    } catch {
      // already disconnected
    }
  }, 1500);
}

function env(g: GainNode, peak: number, attack: number, decay: number, t = ctx!.currentTime) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noise(
  dur: number,
  freq: number,
  q: number,
  peak: number,
  type: BiquadFilterType = "bandpass",
  sweepTo?: number,
  delay = 0,
  attack = 0.004,
) {
  if (!ctx || !sfxGain || !noiseBuffer) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, peak, attack, dur, t);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Very short bright transient — the "crack" that makes a shot read as loud. */
function crack(peak: number, freq = 4200, dur = 0.035, delay = 0) {
  noise(dur, freq, 0.7, peak, "highpass", freq * 0.4, delay, 0.001);
}

/** Low body thump under a shot / impact. */
function body(freq: number, dur: number, peak: number, to = freq * 0.3) {
  tone(freq, dur, peak, "sine", to);
  tone(freq * 1.5, dur * 0.6, peak * 0.4, "triangle", to);
}

/** Slap-back echo layer: makes shots sound like they happen in an arena. */
function tail(peak: number, freq = 1200, dur = 0.3, delay = 0.075) {
  noise(dur, freq, 0.5, peak, "lowpass", freq * 0.35, delay, 0.02);
  noise(dur * 1.4, freq * 0.5, 0.4, peak * 0.5, "lowpass", freq * 0.2, delay + 0.09, 0.04);
}

function tone(
  freq: number,
  dur: number,
  peak: number,
  type: OscillatorType = "sine",
  slideTo?: number,
  delay = 0,
) {
  if (!ctx || !sfxGain) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  const g = ctx.createGain();
  env(g, peak, 0.005, dur, t);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const Sfx = {
  shoot(weapon: string) {
    if (!ctx) return;
    switch (weapon) {
      case 'shotgun':
        crack(0.85, 5200, 0.045);
        noise(0.3, 1400, 0.5, 0.95, 'lowpass', 220);
        body(130, 0.24, 0.65, 38);
        tail(0.34, 1000, 0.34, 0.07);
        break;
      case 'tacshotgun':
        crack(0.8, 5600, 0.038);
        noise(0.22, 1800, 0.55, 0.8, 'lowpass', 300);
        body(160, 0.16, 0.5, 55);
        tail(0.26, 1200, 0.26, 0.06);
        break;
      case 'pickaxe':
        noise(0.2, 900, 1.6, 0.28, 'bandpass', 2600, 0, 0.05);
        tone(320, 0.16, 0.1, 'sine', 700);
        break;
      case 'rocket':
        // Deep launch boom + rising howl
        body(55, 0.5, 0.9, 22);
        noise(0.55, 800, 0.35, 0.85, 'lowpass', 140);
        crack(0.45, 2800, 0.06);
        tail(0.5, 700, 0.65, 0.1);
        break;
      case 'sniper':
        crack(1.0, 6500, 0.05);
        noise(0.34, 2600, 0.5, 0.85, 'lowpass', 260);
        body(170, 0.3, 0.6, 40);
        tail(0.45, 1400, 0.55, 0.085);
        tail(0.22, 700, 0.7, 0.24);
        break;
      case 'heavy_sniper':
        // Thundering .50-cal — sub-bass boom + long echo
        crack(1.0, 5800, 0.07);
        body(40, 0.7, 1.0, 18);
        noise(0.6, 2200, 0.4, 0.9, 'lowpass', 180);
        tail(0.7, 900, 0.8, 0.1);
        tail(0.4, 500, 0.55, 0.3);
        // distant echo
        noise(0.5, 600, 0.3, 0.3, 'lowpass', 120, 0.45, 0.08);
        break;
      case 'deagle':
        // Heavy hand-cannon: deep bass crack + metallic resonance
        crack(0.95, 4800, 0.055);
        body(80, 0.35, 0.85, 28);
        noise(0.25, 1800, 0.7, 0.75, 'lowpass', 350);
        tail(0.4, 1100, 0.45, 0.08);
        break;
      case 'minigun':
        // Rapid rattle with mechanical spin feel
        crack(0.35, 4800, 0.018);
        noise(0.06, 2800, 1.4, 0.45, 'bandpass', 1200);
        body(220, 0.05, 0.3, 80);
        // mechanical rattle overtone
        tone(55, 0.05, 0.22, 'sawtooth', 48);
        break;
      case 'ak47':
        // Loud tactical bang + wood clap + casing
        crack(0.75, 4600, 0.038);
        noise(0.18, 1900, 0.8, 0.7, 'bandpass', 700);
        body(180, 0.14, 0.5, 55);
        tail(0.22, 1100, 0.25, 0.06);
        break;
      case 'm4a1':
        // Suppressed: soft thump + bolt clack
        noise(0.09, 3500, 2.0, 0.5, 'bandpass', 1600);
        body(120, 0.07, 0.35, 50);
        // bolt
        noise(0.035, 4500, 2.5, 0.25, 'highpass', 2500, 0.04, 0.002);
        break;
      case 'smg':
        // MP5 suppressed: soft plop + quick bolt
        crack(0.42, 5200, 0.022);
        noise(0.075, 2600, 1.2, 0.4, 'bandpass', 1300);
        body(240, 0.06, 0.28, 90);
        tail(0.1, 1500, 0.12, 0.045);
        break;
      case 'mac10':
        // Very fast, high-pitch rattle
        crack(0.38, 5800, 0.016);
        noise(0.05, 3200, 1.5, 0.35, 'bandpass', 1500);
        body(280, 0.04, 0.22, 100);
        break;
      case 'bow':
        // String twang + arrow whistle
        tone(800, 0.12, 0.45, 'triangle', 200);
        noise(0.18, 900, 1.8, 0.3, 'bandpass', 2400, 0.02, 0.01);
        break;
      case 'crossbow':
        // Mechanical click + bolt hiss
        tone(1200, 0.035, 0.3, 'square', 400);
        noise(0.12, 1400, 2.0, 0.22, 'bandpass', 2800, 0.025, 0.005);
        break;
      case 'pistol':
        crack(0.55, 5600, 0.028);
        noise(0.1, 2300, 1.0, 0.5, 'bandpass', 1000);
        body(280, 0.08, 0.32, 100);
        tail(0.14, 1500, 0.16, 0.05);
        break;
      case 'rifle':
        crack(0.6, 5000, 0.03);
        noise(0.12, 2200, 0.9, 0.55, 'bandpass', 800);
        body(200, 0.1, 0.4, 70);
        tail(0.18, 1300, 0.2, 0.055);
        break;
      default:
        // generic assault rifle fallback
        crack(0.6, 5000, 0.03);
        noise(0.12, 2200, 0.9, 0.55, 'bandpass', 800);
        body(200, 0.1, 0.4, 70);
        tail(0.18, 1300, 0.2, 0.055);
    }
  },
  /** Fortnite-style pickaxe clang on a structure. */
  pickaxeHit() {
    crack(0.45, 6000, 0.02);
    tone(1150, 0.09, 0.3, "triangle", 780);
    tone(2300, 0.06, 0.16, "square", 1600);
    noise(0.12, 2400, 1.6, 0.24, "bandpass", 900);
    body(150, 0.12, 0.24, 70);
    tail(0.1, 1100, 0.16, 0.05);
  },
  /** Pickaxe hitting an opponent — duller, fleshier thud. */
  pickaxeFlesh() {
    noise(0.14, 700, 1.0, 0.4, "lowpass", 220);
    body(120, 0.14, 0.34, 55);
    tone(520, 0.07, 0.14, "triangle", 300);
  },
  hit() {
    if (!ctx || throttled('hit')) return;
    // crisp hitmarker tick
    crack(0.3, 5200, 0.02);
    tone(1750, 0.05, 0.26, "triangle", 1250);
  },
  /** shield absorbed the hit — metallic ping, clearly different from flesh */
  shieldHit() {
    if (!ctx || throttled('shieldHit')) return;
    crack(0.22, 4200, 0.02);
    tone(2300, 0.07, 0.22, "sine", 1500);
    tone(3200, 0.05, 0.14, "triangle", 2400);
  },
  headshot() {
    if (!ctx || throttled('headshot')) return;
    crack(0.4, 7000, 0.025);
    tone(2500, 0.07, 0.34, "square", 1700);
    tone(1300, 0.14, 0.18, "sine", 900);
  },
  hurt() {
    if (!ctx || throttled('hurt')) return;
    noise(0.2, 600, 0.6, 0.45, "lowpass", 180);
    tone(140, 0.16, 0.26, "sawtooth", 70);
  },
  build() {
    // wood/metal snap-in-place
    noise(0.05, 2400, 1.4, 0.22, "bandpass", 900);
    tone(300, 0.1, 0.3, "triangle", 620);
    body(110, 0.12, 0.28, 60);
  },
  edit() {
    tone(1050, 0.045, 0.2, "square", 1500);
    noise(0.035, 3200, 2, 0.12);
  },
  reload() {
    noise(0.05, 1200, 2.5, 0.28, "bandpass", 500);
    tone(180, 0.07, 0.16, "square", 90);
    noise(0.05, 900, 2.5, 0.26, "bandpass", 420, 0.16);
    noise(0.07, 2000, 1.5, 0.22, "bandpass", 700, 0.29);
    tone(260, 0.06, 0.14, "square", 140, 0.29);
  },
  switchWeapon() {
    noise(0.04, 2600, 2, 0.16, "bandpass", 1200);
    tone(760, 0.05, 0.16, "triangle", 1050);
  },
  jump() {
    tone(420, 0.07, 0.14, "sine", 640);
    noise(0.05, 700, 1.2, 0.1, "lowpass");
  },
  step() {
    noise(0.055, 320, 1.2, 0.11, "lowpass", 150);
  },
  countdown(final: boolean) {
    tone(final ? 940 : 560, final ? 0.32 : 0.14, 0.32, "triangle");
    tone(final ? 1880 : 1120, final ? 0.18 : 0.08, 0.12, "sine");
  },
  kill() {
    tone(880, 0.12, 0.3, "triangle", 1320);
    tone(1320, 0.18, 0.26, "triangle", 1760, 0.1);
    noise(0.08, 4000, 1.2, 0.14, "highpass", 2000, 0.1);
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(f, 0.3, 0.28, "triangle", undefined, i * 0.13);
      tone(f * 2, 0.2, 0.1, "sine", undefined, i * 0.13);
    });
  },
  defeat() {
    [520, 415, 330, 247].forEach((f, i) => tone(f, 0.35, 0.26, "sawtooth", f * 0.9, i * 0.15));
  },
  explosion() {
    crack(0.6, 4000, 0.05);
    noise(0.8, 1200, 0.4, 1.0, "lowpass", 90);
    body(95, 0.6, 0.7, 26);
    noise(0.55, 700, 0.6, 0.4, "lowpass", 200, 0.06, 0.03);
    tail(0.35, 600, 0.7, 0.18);
  },
  breakBuild() {
    noise(0.07, 3000, 1.2, 0.3, "bandpass", 1200);
    noise(0.3, 800, 0.6, 0.4, "lowpass", 180, 0.02, 0.01);
    body(120, 0.2, 0.3, 50);
  },
  /** Mini Shield drinking sound — 1.5s bubbling gurgle */
  drink() {
    if (!ctx) return;
    // bubble pops
    for (let i = 0; i < 6; i++) {
      const delay = i * 0.22;
      noise(0.09, 300 + i * 40, 2.0, 0.25, 'lowpass', 120, delay, 0.02);
      tone(180 + i * 15, 0.07, 0.14, 'sine', 90, delay);
    }
    // deep swallow at end
    noise(0.2, 200, 1.5, 0.4, 'lowpass', 80, 1.1, 0.04);
    body(90, 0.18, 0.3, 40);
  },
  /** Shield fully broken — glass shatter */
  shieldBreak() {
    if (!ctx) return;
    crack(0.5, 6500, 0.025);
    noise(0.35, 4500, 0.7, 0.6, 'highpass', 2000, 0, 0.005);
    noise(0.5, 1200, 0.5, 0.4, 'lowpass', 300, 0.04, 0.02);
    body(95, 0.28, 0.3, 40);
  },
};

export function startMusic() {
  if (!ctx || !musicGain || musicNodes) return;
  const t = ctx.currentTime;
  const notes = [55, 82.5, 110];
  const oscs = notes.map((f, i) => {
    const o = ctx!.createOscillator();
    o.type = i === 0 ? "sawtooth" : "sine";
    o.frequency.value = f;
    const g = ctx!.createGain();
    g.gain.value = i === 0 ? 0.25 : 0.12;
    const filt = ctx!.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 420;
    o.connect(g).connect(filt).connect(musicGain!);
    o.start(t);
    return o;
  });
  musicNodes = { osc: oscs };
}

export function stopMusic() {
  if (!musicNodes || !ctx) return;
  musicNodes.osc.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
  });
  musicNodes = null;
}

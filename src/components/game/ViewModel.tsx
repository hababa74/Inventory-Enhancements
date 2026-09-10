import { Component, type ReactNode, Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";
import { WEAPONS, type WeaponId } from "../../game/constants";
import { input } from "../../game/input";
import { PickaxeModel } from "./PickaxeModel";

class PickaxeErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("Could not load Pickaxe GLTF model, falling back to procedural pickaxe:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function ProceduralPickaxe({ m }: { m: Record<string, THREE.Material> }) {
  return (
    <group>
      <mesh material={m.handle} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.85, 8]} />
      </mesh>
      <mesh material={m.steel} position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.4, 6]} />
      </mesh>
    </group>
  );
}

const offset = new THREE.Vector3();

function mat(color: string, roughness = 0.45, metalness = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** First-person weapon / build-tool view model, driven from the camera transform. */
export function ViewModel() {
  const camera = useThree((s) => s.camera);
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const tool = useRef<THREE.Group>(null);
  const gun = useRef<THREE.Group>(null);
  const slots = useRef<Record<string, THREE.Group | null>>({});
  const kick = useRef(0);
  const pick = useRef<THREE.Group>(null);
  const swing = useRef(0);
  const swingT = useRef(0);

  const m = useMemo(
    () => ({
      // shared
      dark: mat("#14181f", 0.5, 0.6),
      blackPolymer: mat("#181b22", 0.65, 0.35),
      steel: mat("#3d4652", 0.35, 0.9),
      chrome: mat("#dce4ec", 0.2, 0.95),
      grip: mat("#16181e", 0.85, 0.15),
      flash: new THREE.MeshBasicMaterial({ color: "#ffeaa0", transparent: true, opacity: 0, toneMapped: false }),
      tool: new THREE.MeshStandardMaterial({
        color: "#48ff9e",
        emissive: "#0d6b45",
        emissiveIntensity: 0.8,
        roughness: 0.35,
        metalness: 0.4,
      }),
      // pistol — dark metal + yellow stripes
      pistolBody: mat("#22262d", 0.4, 0.7),
      pistolStripe: mat("#f5c518", 0.4, 0.5),
      // woods
      wood: mat("#8a5a2b", 0.75, 0.1),
      woodDark: mat("#583618", 0.8, 0.1),
      star: new THREE.MeshStandardMaterial({ color: "#ffd447", emissive: "#4a3400", emissiveIntensity: 0.4, roughness: 0.4 }),
      // tac shotgun — orange polymer
      tacBody: mat("#c2691f", 0.55, 0.3),
      // smg — blue / black with star decals
      smgBlue: mat("#2f6fe0", 0.45, 0.55),
      smgDark: mat("#171a20", 0.6, 0.4),
      // rifle — desert camo + red skull decal
      tan: mat("#c2a677", 0.7, 0.2),
      tanDark: mat("#9a8054", 0.75, 0.2),
      red: new THREE.MeshStandardMaterial({ color: "#d9312b", emissive: "#3a0a08", emissiveIntensity: 0.5, roughness: 0.5 }),
      // sniper & military greens
      green: mat("#3f5c34", 0.7, 0.2),
      greenDark: mat("#27381f", 0.75, 0.2),
      heavyGreen: mat("#2f422b", 0.65, 0.3),
      glass: new THREE.MeshStandardMaterial({ color: "#7fe6ff", emissive: "#1d5f74", emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 }),
      // rocket launcher — gold + black
      gold: mat("#e0b64a", 0.3, 0.95),
      goldDark: mat("#8a6c20", 0.4, 0.9),
      oliveGreen: mat("#4a5e2a", 0.7, 0.2),
      // potion bottle & string & bow
      potionBottle: new THREE.MeshPhysicalMaterial({
        color: "#38bdf8",
        emissive: "#0284c7",
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.75,
        roughness: 0.1,
        metalness: 0.1,
      }),
      potionCork: mat("#966336", 0.85, 0.05),
      potionGlow: new THREE.MeshBasicMaterial({ color: "#00f0ff" }),
      stringMat: mat("#d1d5db", 0.9, 0.1),
      featherMat: mat("#ef4444", 0.6, 0.2),
    }),
    [],
  );

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const a = engine.player;
    const w = WEAPONS[engine.weapon];

    kick.current += (a.shootAnim - kick.current) * (1 - Math.exp(-20 * dt));

    // ---- pickaxe swing: wind up over the shoulder, chop down, ease back
    if (a.shootAnim > swing.current + 0.4) swingT.current = 0;
    swing.current = a.shootAnim;
    swingT.current = Math.min(1, swingT.current + dt / 0.42);
    const melee = w.melee === true;
    if (pick.current) {
      const s = swingT.current;
      // three phases: raise high to the right, fast diagonal chop down-left, recover
      const arc = s < 0.22 ? -0.75 * (s / 0.22) : s < 0.48 ? -0.75 + 2.5 * ((s - 0.22) / 0.26) : 1.75 * Math.pow(1 - (s - 0.48) / 0.52, 1.5);
      const twist = s < 0.22 ? 0.5 * (s / 0.22) : s < 0.48 ? 0.5 - 1.35 * ((s - 0.22) / 0.26) : -0.85 * (1 - (s - 0.48) / 0.52);
      const idle = Math.sin(engine.bobTime * 1.6) * 0.06 + Math.sin(engine.bobTime * 3.1) * 0.025;
      pick.current.rotation.set(arc * 1.05 + idle * 0.4, 0.35 - arc * 0.35 + twist * 0.5 + idle, -0.34 + twist);
      pick.current.position.set(0.05 - twist * 0.14, -0.05 - arc * 0.09 + idle * 0.05, -0.02 - Math.max(0, arc) * 0.2);
    }

    const bob = Math.sin(engine.bobTime * 2) * 0.014 * Math.min(1, a.speed / 7);
    const bobY = Math.abs(Math.cos(engine.bobTime * 2)) * 0.02 * Math.min(1, a.speed / 7);
    const reload = a.reloadAnim;
    const scoped = engine.scoped;

    // the pickaxe is carried lower and swings the whole arm — no gun recoil pose
    if (melee) {
      const s = swingT.current;
      const push = s < 0.48 ? Math.max(0, (s - 0.22) / 0.26) : Math.max(0, 1 - (s - 0.48) / 0.3);
      offset.set(0.3 + bob - push * 0.12, -0.26 - bobY + push * 0.05, -0.46 - push * 0.14);
    } else {
      offset.set(
        scoped ? 0 : 0.26 + bob,
        (scoped ? -0.06 : -0.2) - bobY - reload * 0.22,
        (scoped ? -0.42 : -0.52) + kick.current * 0.1,
      );
    }
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    g.translateX(offset.x);
    g.translateY(offset.y);
    g.translateZ(offset.z);
    if (melee) {
      const s = swingT.current;
      const chop = s < 0.22 ? -0.5 * (s / 0.22) : s < 0.48 ? -0.5 + 1.5 * ((s - 0.22) / 0.26) : 1.0 * (1 - (s - 0.48) / 0.52);
      g.rotateX(chop * 0.18 - a.vy * 0.003);
      g.rotateZ(-chop * 0.12);
      g.rotateY(chop * 0.1);
    } else {
      const swayX = -input.mouseDX * 0.0015;
      const swayY = -input.mouseDY * 0.0015;
      const sprinting = a.speed > 6.5;
      g.rotateX(kick.current * 0.14 + reload * 0.5 - a.vy * 0.004 + swayY);
      g.rotateZ(reload * 0.4 + swayX + (sprinting ? 0.12 : 0));
      g.rotateY(swayX * 0.5);
    }

    const build = engine.buildMode || engine.editMode;
    // scoped snipers hide the gun so the scope view stays clear
    const scopeHidden = scoped && w.scope !== undefined && !build;
    if (tool.current) tool.current.visible = build;
    if (gun.current) gun.current.visible = !build && !scopeHidden;
    for (const id in slots.current) {
      const s = slots.current[id];
      if (s) s.visible = id === engine.weapon;
    }
    const hasFlash = !melee && w.id !== "mini_shield" && w.id !== "bow" && w.id !== "crossbow";
    if (flash.current) flash.current.visible = hasFlash;
    if (flash.current && hasFlash) {
      (flash.current.material as THREE.MeshBasicMaterial).opacity = a.shootAnim * 0.9;
      flash.current.scale.setScalar(0.35 + a.shootAnim * 0.7);
      flash.current.position.z =
        w.id === "heavy_sniper"
          ? -1.35
          : w.id === "sniper"
          ? -1.15
          : w.id === "rocket"
          ? -0.95
          : w.id === "pistol" || w.id === "deagle"
          ? -0.5
          : -0.85;
    }
  });

  const slot = (id: WeaponId, children: React.ReactNode, scale = 1, pos: [number, number, number] = [0, 0, 0]) => (
    <group
      key={id}
      visible={false}
      scale={scale}
      position={pos}
      ref={(g) => {
        slots.current[id] = g;
      }}
    >
      {children}
    </group>
  );

  return (
    <group ref={root} renderOrder={10} scale={0.82}>
      <pointLight intensity={6} distance={4} color="#cfe6ff" position={[0.1, 0.25, 0.3]} />
      <group ref={gun} scale={0.68} position={[0.03, -0.055, -0.08]} rotation={[0, 0.05, 0]}>
        {/* ---- PICKAXE : always-carried harvesting tool ---- */}
        {slot(
          "pickaxe",
          <group ref={pick}>
            {/* uploaded pickaxe model, held like the old procedural tool */}
            <group position={[0.04, -0.1, -0.26]} rotation={[1.05, 0, 0.22]}>
              <PickaxeErrorBoundary fallback={<ProceduralPickaxe m={m} />}>
                <Suspense fallback={<ProceduralPickaxe m={m} />}>
                  <PickaxeModel />
                </Suspense>
              </PickaxeErrorBoundary>
            </group>
          </group>,
        )}

        {/* ---- PISTOL : Glock-19 tactical black polymer ---- */}
        {slot(
          "pistol",
          <>
            <mesh material={m.pistolBody} position={[0, 0.02, -0.24]}>
              <boxGeometry args={[0.075, 0.11, 0.42]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.078, -0.2]}>
              <boxGeometry args={[0.055, 0.02, 0.12]} />
            </mesh>
            <mesh material={m.steel} position={[0.038, 0.04, -0.1]}>
              <boxGeometry args={[0.003, 0.06, 0.08]} />
            </mesh>
            <mesh material={m.steel} position={[-0.038, 0.04, -0.1]}>
              <boxGeometry args={[0.003, 0.06, 0.08]} />
            </mesh>
            <mesh material={m.steel} position={[0, -0.01, -0.46]}>
              <boxGeometry args={[0.04, 0.04, 0.08]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.13, -0.06]} rotation={[0.28, 0, 0]}>
              <boxGeometry args={[0.065, 0.22, 0.1]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.24, -0.02]} rotation={[0.28, 0, 0]}>
              <boxGeometry args={[0.068, 0.025, 0.11]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.07, -0.14]}>
              <boxGeometry args={[0.03, 0.06, 0.08]} />
            </mesh>
          </>,
        )}

        {/* ---- SHOTGUN : Classic wooden pump-action shotgun ---- */}
        {slot(
          "shotgun",
          <>
            <mesh material={m.steel} position={[0, 0.03, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.032, 0.032, 0.98, 10]} />
            </mesh>
            <mesh material={m.steel} position={[0, -0.025, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.8, 10]} />
            </mesh>
            <mesh material={m.wood} position={[0, -0.025, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.28, 8]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.01, -0.12]}>
              <boxGeometry args={[0.085, 0.13, 0.34]} />
            </mesh>
            <mesh material={m.star} position={[0.044, 0.02, -0.12]} rotation={[0, Math.PI / 2, 0]}>
              <circleGeometry args={[0.032, 5]} />
            </mesh>
            <mesh material={m.wood} position={[0, -0.06, 0.16]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[0.068, 0.13, 0.36]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.09, 0.34]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[0.07, 0.14, 0.03]} />
            </mesh>
          </>,
        )}

        {/* ---- TACSHOTGUN : Orange tactical shotgun ---- */}
        {slot(
          "tacshotgun",
          <>
            <mesh material={m.tacBody} position={[0, 0.01, -0.3]}>
              <boxGeometry args={[0.1, 0.12, 0.6]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.03, -0.66]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.3, 10]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.09, -0.24]}>
              <boxGeometry args={[0.05, 0.03, 0.4]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.13, -0.02]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.065, 0.22, 0.1]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.02, 0.16]}>
              <boxGeometry args={[0.06, 0.1, 0.24]} />
            </mesh>
          </>,
        )}

        {/* ---- RIFLE : FN-SCAR Tactical Tan Assault Rifle ---- */}
        {slot(
          "rifle",
          <>
            <mesh material={m.tan} position={[0, 0.02, -0.3]}>
              <boxGeometry args={[0.09, 0.13, 0.66]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.1, -0.3]}>
              <boxGeometry args={[0.05, 0.03, 0.64]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.14, -0.2]}>
              <boxGeometry args={[0.06, 0.06, 0.14]} />
            </mesh>
            <mesh material={m.glass} position={[0, 0.14, -0.27]}>
              <boxGeometry args={[0.045, 0.045, 0.01]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.02, -0.72]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.3, 8]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.02, -0.88]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.28, 12]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.16, -0.2]} rotation={[0.15, 0, 0]}>
              <boxGeometry args={[0.06, 0.28, 0.1]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.13, 0.0]} rotation={[0.32, 0, 0]}>
              <boxGeometry args={[0.06, 0.2, 0.09]} />
            </mesh>
            <mesh material={m.tanDark} position={[0, 0.0, 0.2]}>
              <boxGeometry args={[0.06, 0.11, 0.32]} />
            </mesh>
          </>,
        )}

        {/* ---- SNIPER : Bolt-Action Sniper with Scope ---- */}
        {slot(
          "sniper",
          <>
            <mesh material={m.woodDark} position={[0, 0.0, -0.4]}>
              <boxGeometry args={[0.08, 0.11, 0.88]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.02, -1.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.48, 10]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.02, -1.26]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.08, 10]} />
            </mesh>
            <mesh material={m.chrome} position={[0.065, 0.05, -0.06]} rotation={[0, 0, -0.55]}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.13, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.44, 12]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.13, -0.64]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.042, 0.08, 12]} />
            </mesh>
            <mesh material={m.glass} position={[0, 0.13, -0.68]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.01, 12]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.08, -0.3]}>
              <boxGeometry args={[0.04, 0.06, 0.05]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.08, -0.54]}>
              <boxGeometry args={[0.04, 0.06, 0.05]} />
            </mesh>
            <mesh material={m.woodDark} position={[0, -0.04, 0.22]} rotation={[0.08, 0, 0]}>
              <boxGeometry args={[0.065, 0.13, 0.4]} />
            </mesh>
          </>,
        )}

        {/* ---- ROCKET : RPG-7 Launcher ---- */}
        {slot(
          "rocket",
          <>
            <mesh material={m.dark} position={[0, 0.04, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.095, 0.095, 1.1, 14]} />
            </mesh>
            <mesh material={m.oliveGreen} position={[0, 0.04, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.102, 0.102, 0.4, 14]} />
            </mesh>
            <mesh material={m.goldDark} position={[0, 0.14, -0.4]}>
              <boxGeometry args={[0.05, 0.045, 0.6]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.12, -0.18]} rotation={[0.28, 0, 0]}>
              <boxGeometry args={[0.06, 0.22, 0.1]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.09, -0.55]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[0.055, 0.17, 0.09]} />
            </mesh>
            {/* loaded warhead */}
            <mesh material={m.oliveGreen} position={[0, 0.04, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.085, 0.24, 12]} />
            </mesh>
            <mesh material={m.red} position={[0, 0.04, -0.92]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.03, 0.08, 8]} />
            </mesh>
          </>,
          0.72,
          [-0.02, -0.03, -0.24],
        )}

        {/* ---- MINI SHIELD : Glowing Cyan Potion Bottle ---- */}
        {slot(
          "mini_shield",
          <>
            <mesh material={m.potionBottle} position={[0, -0.04, -0.32]}>
              <cylinderGeometry args={[0.1, 0.11, 0.24, 16]} />
            </mesh>
            <mesh material={m.potionBottle} position={[0, -0.16, -0.32]}>
              <sphereGeometry args={[0.1, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            </mesh>
            <mesh material={m.potionBottle} position={[0, 0.11, -0.32]}>
              <cylinderGeometry args={[0.048, 0.075, 0.09, 14]} />
            </mesh>
            <mesh material={m.potionBottle} position={[0, 0.16, -0.32]}>
              <torusGeometry args={[0.05, 0.016, 8, 16]} />
            </mesh>
            <mesh material={m.potionCork} position={[0, 0.19, -0.32]}>
              <cylinderGeometry args={[0.046, 0.042, 0.07, 12]} />
            </mesh>
            <mesh material={m.potionGlow} position={[0, -0.06, -0.32]}>
              <cylinderGeometry args={[0.088, 0.095, 0.18, 14]} />
            </mesh>
          </>,
          0.9,
          [0.08, -0.02, -0.05],
        )}

        {/* ---- AK-47 : Classic assault rifle with banana mag & wood stock ---- */}
        {slot(
          "ak47",
          <>
            <mesh material={m.dark} position={[0, 0.02, -0.28]}>
              <boxGeometry args={[0.08, 0.12, 0.58]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.04, -0.74]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
            </mesh>
            <mesh material={m.wood} position={[0, 0.02, -0.52]}>
              <boxGeometry args={[0.075, 0.09, 0.26]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.04, -0.96]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.02, 0.07, 8]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.09, -0.91]}>
              <boxGeometry args={[0.015, 0.06, 0.02]} />
            </mesh>
            <mesh material={m.steel} position={[0, -0.16, -0.22]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.055, 0.32, 0.12]} />
            </mesh>
            <mesh material={m.wood} position={[0, -0.12, -0.02]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.055, 0.18, 0.08]} />
            </mesh>
            <mesh material={m.wood} position={[0, -0.03, 0.2]}>
              <boxGeometry args={[0.065, 0.13, 0.36]} />
            </mesh>
          </>,
        )}

        {/* ---- M4-A1 : Tactical suppressed carbine with carry handle ---- */}
        {slot(
          "m4a1",
          <>
            <mesh material={m.blackPolymer} position={[0, 0.01, -0.28]}>
              <boxGeometry args={[0.08, 0.12, 0.54]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.1, -0.24]}>
              <boxGeometry args={[0.04, 0.07, 0.3]} />
            </mesh>
            <mesh material={m.blackPolymer} position={[0, 0.02, -0.54]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.28, 10]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.02, -0.84]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.38, 12]} />
            </mesh>
            <mesh material={m.steel} position={[0, -0.15, -0.22]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[0.055, 0.26, 0.09]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.12, 0.0]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.055, 0.19, 0.085]} />
            </mesh>
            <mesh material={m.blackPolymer} position={[0, 0.0, 0.18]}>
              <boxGeometry args={[0.06, 0.11, 0.28]} />
            </mesh>
          </>,
        )}

        {/* ---- DEAGLE : Heavy Chrome Desert Eagle ---- */}
        {slot(
          "deagle",
          <>
            <mesh material={m.chrome} position={[0, 0.04, -0.28]}>
              <boxGeometry args={[0.088, 0.12, 0.48]} />
            </mesh>
            <mesh material={m.chrome} position={[0, 0.02, -0.54]}>
              <boxGeometry args={[0.076, 0.09, 0.14]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.04, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.04, 10]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.14, -0.08]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.075, 0.24, 0.12]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.26, -0.04]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.08, 0.03, 0.13]} />
            </mesh>
            <mesh material={m.chrome} position={[0, -0.08, -0.18]}>
              <boxGeometry args={[0.03, 0.07, 0.1]} />
            </mesh>
          </>,
        )}

        {/* ---- CROSSBOW : Wood & steel crossbow with bolt rail ---- */}
        {slot(
          "crossbow",
          <>
            <mesh material={m.wood} position={[0, -0.02, -0.32]}>
              <boxGeometry args={[0.08, 0.09, 0.72]} />
            </mesh>
            <mesh material={m.steel} position={[-0.24, 0.02, -0.58]} rotation={[0, 0.4, 0]}>
              <boxGeometry args={[0.26, 0.035, 0.04]} />
            </mesh>
            <mesh material={m.steel} position={[0.24, 0.02, -0.58]} rotation={[0, -0.4, 0]}>
              <boxGeometry args={[0.26, 0.035, 0.04]} />
            </mesh>
            <mesh material={m.stringMat} position={[-0.18, 0.02, -0.46]} rotation={[0, -0.7, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.32, 6]} />
            </mesh>
            <mesh material={m.stringMat} position={[0.18, 0.02, -0.46]} rotation={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.32, 6]} />
            </mesh>
            <mesh material={m.woodDark} position={[0, 0.04, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.42, 6]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.04, -0.71]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.025, 0.08, 4]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.09, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.28, 10]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.15, -0.06]} rotation={[0.28, 0, 0]}>
              <boxGeometry args={[0.06, 0.19, 0.08]} />
            </mesh>
          </>,
        )}

        {/* ---- BOW : Recurve wooden bow with arrow ---- */}
        {slot(
          "bow",
          <>
            <mesh material={m.wood} position={[0, 0.28, -0.42]} rotation={[-0.32, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.016, 0.44, 8]} />
            </mesh>
            <mesh material={m.wood} position={[0, -0.28, -0.42]} rotation={[0.32, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.024, 0.44, 8]} />
            </mesh>
            <mesh material={m.grip} position={[0, 0, -0.46]}>
              <boxGeometry args={[0.045, 0.16, 0.06]} />
            </mesh>
            <mesh material={m.stringMat} position={[0, 0, -0.28]}>
              <cylinderGeometry args={[0.005, 0.005, 0.9, 6]} />
            </mesh>
            <mesh material={m.woodDark} position={[0, 0, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.72, 6]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0, -0.84]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.024, 0.07, 4]} />
            </mesh>
            <mesh material={m.featherMat} position={[0, 0.02, -0.18]}>
              <boxGeometry args={[0.005, 0.04, 0.12]} />
            </mesh>
            <mesh material={m.featherMat} position={[0.02, 0, -0.18]}>
              <boxGeometry args={[0.04, 0.005, 0.12]} />
            </mesh>
          </>,
        )}

        {/* ---- HEAVY SNIPER : .50 Cal Anti-Materiel Rifle ---- */}
        {slot(
          "heavy_sniper",
          <>
            <mesh material={m.heavyGreen} position={[0, 0.02, -0.38]}>
              <boxGeometry args={[0.11, 0.15, 0.88]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.03, -1.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.58, 10]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.03, -1.38]}>
              <boxGeometry args={[0.1, 0.075, 0.16]} />
            </mesh>
            <mesh material={m.dark} position={[-0.07, -0.06, -0.8]} rotation={[0.2, 0, -0.3]}>
              <cylinderGeometry args={[0.014, 0.014, 0.28, 6]} />
            </mesh>
            <mesh material={m.dark} position={[0.07, -0.06, -0.8]} rotation={[0.2, 0, 0.3]}>
              <cylinderGeometry args={[0.014, 0.014, 0.28, 6]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.16, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.52, 12]} />
            </mesh>
            <mesh material={m.glass} position={[0, 0.16, -0.67]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.048, 0.048, 0.01, 12]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.15, -0.22]}>
              <boxGeometry args={[0.07, 0.24, 0.14]} />
            </mesh>
            <mesh material={m.heavyGreen} position={[0, -0.01, 0.24]}>
              <boxGeometry args={[0.08, 0.14, 0.36]} />
            </mesh>
          </>,
        )}

        {/* ---- MINIGUN : 6-Barrel Rotary Machine Gun ---- */}
        {slot(
          "minigun",
          <>
            <mesh material={m.dark} position={[0, 0, -0.36]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.45, 16]} />
            </mesh>
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const bx = Math.sin(rad) * 0.075;
              const by = Math.cos(rad) * 0.075;
              return (
                <mesh
                  key={deg}
                  material={m.steel}
                  position={[bx, by, -0.8]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.015, 0.015, 0.65, 8]} />
                </mesh>
              );
            })}
            <mesh material={m.dark} position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.03, 16]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0, -1.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.03, 16]} />
            </mesh>
            <mesh material={m.dark} position={[0.16, -0.06, -0.3]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.13, 0.13, 0.16, 14]} />
            </mesh>
            <mesh material={m.grip} position={[0, 0.16, -0.32]}>
              <boxGeometry args={[0.04, 0.04, 0.28]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.02, 0.0]}>
              <boxGeometry args={[0.18, 0.06, 0.06]} />
            </mesh>
          </>,
          0.8,
          [0.05, -0.05, 0],
        )}

        {/* ---- MAC-10 : Compact Submachine Gun ---- */}
        {slot(
          "mac10",
          <>
            <mesh material={m.dark} position={[0, 0.04, -0.22]}>
              <boxGeometry args={[0.075, 0.12, 0.38]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.05, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
            </mesh>
            <mesh material={m.steel} position={[0, -0.22, -0.16]}>
              <boxGeometry args={[0.05, 0.32, 0.07]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.1, -0.16]}>
              <boxGeometry args={[0.065, 0.16, 0.09]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.12, -0.24]}>
              <cylinderGeometry args={[0.016, 0.016, 0.04, 8]} />
            </mesh>
            <mesh material={m.steel} position={[-0.04, 0.02, 0.02]}>
              <boxGeometry args={[0.01, 0.06, 0.12]} />
            </mesh>
            <mesh material={m.steel} position={[0.04, 0.02, 0.02]}>
              <boxGeometry args={[0.01, 0.06, 0.12]} />
            </mesh>
          </>,
        )}

        {/* ---- SMG : MP5 Submachine Gun ---- */}
        {slot(
          "smg",
          <>
            <mesh material={m.blackPolymer} position={[0, 0.02, -0.26]}>
              <boxGeometry args={[0.08, 0.12, 0.52]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.01, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.22, 10]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.03, -0.68]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.24, 10]} />
            </mesh>
            <mesh material={m.dark} position={[0, -0.18, -0.24]} rotation={[0.26, 0, 0]}>
              <boxGeometry args={[0.05, 0.28, 0.08]} />
            </mesh>
            <mesh material={m.steel} position={[0, 0.08, -0.58]}>
              <torusGeometry args={[0.022, 0.006, 6, 12]} />
            </mesh>
            <mesh material={m.grip} position={[0, -0.12, -0.02]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.055, 0.19, 0.085]} />
            </mesh>
            <mesh material={m.dark} position={[0, 0.0, 0.12]}>
              <boxGeometry args={[0.065, 0.09, 0.2]} />
            </mesh>
          </>,
        )}

        <mesh ref={flash} material={m.flash} position={[0, 0.02, -0.85]}>
          <sphereGeometry args={[0.12, 8, 8]} />
        </mesh>
      </group>

      <group ref={tool} visible={false} position={[0.04, -0.08, -0.18]} scale={0.75}>
        <mesh material={m.dark} position={[0, -0.06, 0.05]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.07, 0.07, 0.4]} />
        </mesh>
        <mesh material={m.tool} position={[0, 0.08, -0.22]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.26, 0.26, 0.04]} />
        </mesh>
        <mesh material={m.tool} position={[0, 0.08, -0.22]} rotation={[0.4, 0, 0.78]}>
          <boxGeometry args={[0.05, 0.3, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

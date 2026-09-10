import { useMemo, Suspense, Component, type ReactNode } from "react";
import * as THREE from "three";
import type { WeaponId } from "../../game/constants";
import { PickaxeModel } from "./PickaxeModel";

class PickaxeFallbackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function mat(color: string, roughness = 0.45, metalness = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * Authentic 3D Weapon Model for third-person player models and the lobby podium.
 * Accurately models every weapon in the game, facing -Z (forward).
 */
export function WeaponProp({ weaponId, shadows = true }: { weaponId: WeaponId; shadows?: boolean }) {
  const m = useMemo(
    () => ({
      steel: mat("#4b5563", 0.35, 0.85),
      dark: mat("#181e26", 0.6, 0.4),
      blackPolymer: mat("#1a1f26", 0.55, 0.35),
      wood: mat("#8a5a36", 0.75, 0.1),
      woodDark: mat("#5c3820", 0.8, 0.08),
      tan: mat("#c2a677", 0.7, 0.2),
      tanDark: mat("#9a8054", 0.75, 0.2),
      tacBody: mat("#ea580c", 0.5, 0.25),
      chrome: mat("#e2e8f0", 0.2, 0.95),
      pistolBody: mat("#252c37", 0.6, 0.4),
      grip: mat("#14181f", 0.8, 0.2),
      smgBlue: mat("#2f6fe0", 0.45, 0.55),
      green: mat("#3f5c34", 0.7, 0.2),
      greenDark: mat("#27381f", 0.75, 0.2),
      heavyGreen: mat("#2f422b", 0.65, 0.3),
      glass: new THREE.MeshStandardMaterial({
        color: "#7fe6ff",
        emissive: "#1d5f74",
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.3,
      }),
      gold: mat("#e0b64a", 0.3, 0.95),
      goldDark: mat("#8a6c20", 0.4, 0.9),
      oliveGreen: mat("#4a5e2a", 0.7, 0.2),
      red: new THREE.MeshStandardMaterial({
        color: "#d9312b",
        emissive: "#3a0a08",
        emissiveIntensity: 0.5,
        roughness: 0.5,
      }),
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
      handle: mat("#8a5a36", 0.8, 0.1),
      star: new THREE.MeshBasicMaterial({ color: "#ffd447" }),
    }),
    [],
  );

  const scale = 0.82;

  switch (weaponId) {
    case "pickaxe":
      return (
        <group scale={scale * 0.9} position={[0, -0.05, -0.1]} rotation={[1.2, 0, 0.15]}>
          <PickaxeFallbackBoundary
            fallback={
              <group>
                <mesh material={m.handle} position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.025, 0.85, 8]} />
                </mesh>
                <mesh material={m.steel} position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.4, 6]} />
                </mesh>
              </group>
            }
          >
            <Suspense fallback={null}>
              <PickaxeModel />
            </Suspense>
          </PickaxeFallbackBoundary>
        </group>
      );

    case "pistol":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.pistolBody} position={[0, 0.02, -0.24]} castShadow={shadows}>
            <boxGeometry args={[0.075, 0.11, 0.42]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.078, -0.2]}>
            <boxGeometry args={[0.055, 0.02, 0.12]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.01, -0.46]} castShadow={shadows}>
            <boxGeometry args={[0.04, 0.04, 0.08]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.13, -0.06]} rotation={[0.28, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.065, 0.22, 0.1]} />
          </mesh>
        </group>
      );

    case "deagle":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.chrome} position={[0, 0.04, -0.28]} castShadow={shadows}>
            <boxGeometry args={[0.088, 0.12, 0.48]} />
          </mesh>
          <mesh material={m.chrome} position={[0, 0.02, -0.54]} castShadow={shadows}>
            <boxGeometry args={[0.076, 0.09, 0.14]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.04, -0.62]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.028, 0.028, 0.04, 10]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.14, -0.08]} rotation={[0.3, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.075, 0.24, 0.12]} />
          </mesh>
          <mesh material={m.chrome} position={[0, -0.08, -0.18]}>
            <boxGeometry args={[0.03, 0.07, 0.1]} />
          </mesh>
        </group>
      );

    case "shotgun":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.steel} position={[0, 0.03, -0.52]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.032, 0.032, 0.98, 10]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.025, -0.48]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.026, 0.026, 0.8, 10]} />
          </mesh>
          <mesh material={m.wood} position={[0, -0.025, -0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.042, 0.042, 0.28, 8]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.01, -0.12]} castShadow={shadows}>
            <boxGeometry args={[0.085, 0.13, 0.34]} />
          </mesh>
          <mesh material={m.star} position={[0.044, 0.02, -0.12]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.032, 5]} />
          </mesh>
          <mesh material={m.wood} position={[0, -0.06, 0.16]} rotation={[0.18, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.068, 0.13, 0.36]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.09, 0.34]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.07, 0.14, 0.03]} />
          </mesh>
        </group>
      );

    case "tacshotgun":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.tacBody} position={[0, 0.01, -0.3]} castShadow={shadows}>
            <boxGeometry args={[0.1, 0.12, 0.6]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.03, -0.66]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.035, 0.035, 0.3, 10]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.09, -0.24]}>
            <boxGeometry args={[0.05, 0.03, 0.4]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.13, -0.02]} rotation={[0.3, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.065, 0.22, 0.1]} />
          </mesh>
          <mesh material={m.dark} position={[0, -0.02, 0.16]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.1, 0.24]} />
          </mesh>
        </group>
      );

    case "rifle":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          {/* FN-SCAR tan receiver */}
          <mesh material={m.tan} position={[0, 0.02, -0.3]} castShadow={shadows}>
            <boxGeometry args={[0.09, 0.13, 0.66]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.1, -0.3]}>
            <boxGeometry args={[0.05, 0.03, 0.64]} />
          </mesh>
          {/* Holographic sight */}
          <mesh material={m.dark} position={[0, 0.14, -0.2]}>
            <boxGeometry args={[0.06, 0.06, 0.14]} />
          </mesh>
          <mesh material={m.glass} position={[0, 0.14, -0.27]}>
            <boxGeometry args={[0.045, 0.045, 0.01]} />
          </mesh>
          {/* Barrel + flash hider */}
          <mesh material={m.steel} position={[0, 0.02, -0.72]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.022, 0.022, 0.3, 8]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.02, -0.88]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.038, 0.038, 0.28, 12]} />
          </mesh>
          {/* Mag + grip + stock */}
          <mesh material={m.dark} position={[0, -0.16, -0.2]} rotation={[0.15, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.28, 0.1]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.13, 0.0]} rotation={[0.32, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.2, 0.09]} />
          </mesh>
          <mesh material={m.tanDark} position={[0, 0.0, 0.2]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.11, 0.32]} />
          </mesh>
        </group>
      );

    case "ak47":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.dark} position={[0, 0.02, -0.28]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.12, 0.58]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.04, -0.74]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.018, 0.018, 0.44, 8]} />
          </mesh>
          <mesh material={m.wood} position={[0, 0.02, -0.52]} castShadow={shadows}>
            <boxGeometry args={[0.075, 0.09, 0.26]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.04, -0.96]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.024, 0.02, 0.07, 8]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.16, -0.22]} rotation={[0.3, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.32, 0.12]} />
          </mesh>
          <mesh material={m.wood} position={[0, -0.12, -0.02]} rotation={[0.35, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.18, 0.08]} />
          </mesh>
          <mesh material={m.wood} position={[0, -0.03, 0.2]} castShadow={shadows}>
            <boxGeometry args={[0.065, 0.13, 0.36]} />
          </mesh>
        </group>
      );

    case "m4a1":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.blackPolymer} position={[0, 0.01, -0.28]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.12, 0.54]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.1, -0.24]}>
            <boxGeometry args={[0.04, 0.07, 0.3]} />
          </mesh>
          <mesh material={m.blackPolymer} position={[0, 0.02, -0.54]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.045, 0.28, 10]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.02, -0.84]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.035, 0.035, 0.38, 12]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.15, -0.22]} rotation={[0.1, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.26, 0.09]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.12, 0.0]} rotation={[0.3, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.19, 0.085]} />
          </mesh>
          <mesh material={m.blackPolymer} position={[0, 0.0, 0.18]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.11, 0.28]} />
          </mesh>
        </group>
      );

    case "sniper":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.woodDark} position={[0, 0.0, -0.4]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.11, 0.88]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.02, -1.02]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.022, 0.022, 0.48, 10]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.02, -1.26]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.03, 0.03, 0.08, 10]} />
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
          <mesh material={m.woodDark} position={[0, -0.04, 0.22]} rotation={[0.08, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.065, 0.13, 0.4]} />
          </mesh>
        </group>
      );

    case "heavy_sniper":
      return (
        <group scale={scale * 0.9} position={[0, 0, 0]}>
          <mesh material={m.heavyGreen} position={[0, 0.02, -0.38]} castShadow={shadows}>
            <boxGeometry args={[0.11, 0.15, 0.88]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.03, -1.04]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.035, 0.035, 0.58, 10]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.03, -1.38]} castShadow={shadows}>
            <boxGeometry args={[0.1, 0.075, 0.16]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.16, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.52, 12]} />
          </mesh>
          <mesh material={m.glass} position={[0, 0.16, -0.67]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.01, 12]} />
          </mesh>
          <mesh material={m.dark} position={[0, -0.15, -0.22]} castShadow={shadows}>
            <boxGeometry args={[0.07, 0.24, 0.14]} />
          </mesh>
          <mesh material={m.heavyGreen} position={[0, -0.01, 0.24]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.14, 0.36]} />
          </mesh>
        </group>
      );

    case "rocket":
      return (
        <group scale={scale * 0.78} position={[0, 0.05, -0.1]}>
          <mesh material={m.dark} position={[0, 0.04, -0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.095, 0.095, 1.1, 14]} />
          </mesh>
          <mesh material={m.oliveGreen} position={[0, 0.04, -0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.102, 0.102, 0.4, 14]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.12, -0.18]} rotation={[0.28, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.22, 0.1]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.09, -0.55]} rotation={[0.1, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.17, 0.09]} />
          </mesh>
          {/* Loaded warhead */}
          <mesh material={m.oliveGreen} position={[0, 0.04, -0.8]} rotation={[-Math.PI / 2, 0, 0]} castShadow={shadows}>
            <coneGeometry args={[0.085, 0.24, 12]} />
          </mesh>
          <mesh material={m.red} position={[0, 0.04, -0.92]} rotation={[-Math.PI / 2, 0, 0]} castShadow={shadows}>
            <coneGeometry args={[0.03, 0.08, 8]} />
          </mesh>
        </group>
      );

    case "minigun":
      return (
        <group scale={scale * 0.75} position={[0, 0, -0.1]}>
          <mesh material={m.dark} position={[0, 0, -0.36]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
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
                castShadow={shadows}
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
          <mesh material={m.dark} position={[0.16, -0.06, -0.3]} rotation={[0, 0, Math.PI / 2]} castShadow={shadows}>
            <cylinderGeometry args={[0.13, 0.13, 0.16, 14]} />
          </mesh>
          <mesh material={m.grip} position={[0, 0.16, -0.32]}>
            <boxGeometry args={[0.04, 0.04, 0.28]} />
          </mesh>
        </group>
      );

    case "smg":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.blackPolymer} position={[0, 0.02, -0.26]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.12, 0.52]} />
          </mesh>
          <mesh material={m.dark} position={[0, 0.01, -0.48]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.042, 0.042, 0.22, 10]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.03, -0.68]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.026, 0.026, 0.24, 10]} />
          </mesh>
          <mesh material={m.dark} position={[0, -0.18, -0.24]} rotation={[0.26, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.05, 0.28, 0.08]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.12, -0.02]} rotation={[0.3, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.055, 0.19, 0.085]} />
          </mesh>
        </group>
      );

    case "mac10":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.dark} position={[0, 0.04, -0.22]} castShadow={shadows}>
            <boxGeometry args={[0.075, 0.12, 0.38]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.05, -0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
          </mesh>
          <mesh material={m.steel} position={[0, -0.22, -0.16]} castShadow={shadows}>
            <boxGeometry args={[0.05, 0.32, 0.07]} />
          </mesh>
          <mesh material={m.grip} position={[0, -0.1, -0.16]} castShadow={shadows}>
            <boxGeometry args={[0.065, 0.16, 0.09]} />
          </mesh>
        </group>
      );

    case "bow":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.wood} position={[0, 0.28, -0.42]} rotation={[-0.32, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.024, 0.016, 0.44, 8]} />
          </mesh>
          <mesh material={m.wood} position={[0, -0.28, -0.42]} rotation={[0.32, 0, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.016, 0.024, 0.44, 8]} />
          </mesh>
          <mesh material={m.grip} position={[0, 0, -0.46]} castShadow={shadows}>
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
        </group>
      );

    case "crossbow":
      return (
        <group scale={scale} position={[0, 0, 0]}>
          <mesh material={m.wood} position={[0, -0.02, -0.32]} castShadow={shadows}>
            <boxGeometry args={[0.08, 0.09, 0.72]} />
          </mesh>
          <mesh material={m.steel} position={[-0.24, 0.02, -0.58]} rotation={[0, 0.4, 0]} castShadow={shadows}>
            <boxGeometry args={[0.26, 0.035, 0.04]} />
          </mesh>
          <mesh material={m.steel} position={[0.24, 0.02, -0.58]} rotation={[0, -0.4, 0]} castShadow={shadows}>
            <boxGeometry args={[0.26, 0.035, 0.04]} />
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
          <mesh material={m.grip} position={[0, -0.15, -0.06]} rotation={[0.28, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.06, 0.19, 0.08]} />
          </mesh>
        </group>
      );

    case "mini_shield":
      return (
        <group scale={scale * 0.9} position={[0, 0.02, -0.25]}>
          <mesh material={m.potionBottle} position={[0, -0.04, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.1, 0.11, 0.24, 16]} />
          </mesh>
          <mesh material={m.potionBottle} position={[0, -0.16, 0]}>
            <sphereGeometry args={[0.1, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          </mesh>
          <mesh material={m.potionBottle} position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.048, 0.075, 0.09, 14]} />
          </mesh>
          <mesh material={m.potionCork} position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.046, 0.042, 0.07, 12]} />
          </mesh>
          <mesh material={m.potionGlow} position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.088, 0.095, 0.18, 14]} />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

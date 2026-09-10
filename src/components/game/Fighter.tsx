import { Component, type ReactNode, Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { engine, type Actor } from "../../game/engine";
import { FIGHTER, MOVE, type WeaponId } from "../../game/constants";
import { DEFAULT_SKIN, type Skin } from "../../game/skins";
import { ModelFighter } from "./ModelFighter";
import { WeaponProp } from "./WeaponProp";

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("Could not load 3D GLTF model, falling back to procedural suit:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

type FighterProps = {
  actor: Actor;
  shadows: boolean;
  skin?: Skin;
  spin?: number;
  /** when set, the fighter visibly carries this weapon (third person) */
  weaponId?: WeaponId | undefined;
};

/** Dispatcher: GLB-model skins render the loaded character, others the procedural suit. */
export function Fighter({ actor, shadows, skin = DEFAULT_SKIN, spin = 0, weaponId }: FighterProps) {
  const held = weaponId ?? (actor === engine.player ? engine.weapon : "rifle");
  return (
    <>
      {skin.model ? (
        <ModelErrorBoundary fallback={<ProceduralFighter actor={actor} shadows={shadows} skin={skin} spin={spin} weaponId={held} />}>
          <Suspense fallback={<ProceduralFighter actor={actor} shadows={shadows} skin={skin} spin={spin} weaponId={held} />}>
            <ModelFighter actor={actor} shadows={shadows} skin={skin} spin={spin} weaponId={held} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <ProceduralFighter actor={actor} shadows={shadows} skin={skin} spin={spin} weaponId={held} />
      )}
      <ScopeGlint actor={actor} />
    </>
  );
}

/**
 * Custom low-poly combat suit. Fully procedural, animated from actor state:
 * idle / run / jump / fall / shoot / reload.
 */
function ProceduralFighter({ actor, shadows, skin = DEFAULT_SKIN, spin = 0, weaponId = "rifle" }: FighterProps) {
  const color = skin.accent;
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Mesh>(null);

  const mats = useMemo(() => {
    const suit = new THREE.MeshStandardMaterial({ color: skin.suit, roughness: 0.6, metalness: 0.3 });
    const trim = new THREE.MeshStandardMaterial({ color: skin.trim, roughness: 0.5, metalness: 0.45 });
    const accent = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.75,
      roughness: 0.4,
      metalness: 0.2,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: "#0d1117",
      emissive: skin.visor,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.6,
      toneMapped: false,
    });
    const gun = new THREE.MeshStandardMaterial({ color: "#1b2230", roughness: 0.45, metalness: 0.7 });
    const wood = new THREE.MeshStandardMaterial({ color: "#784b25", roughness: 0.75, metalness: 0.1 });
    const chrome = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.2, metalness: 0.95 });
    const tan = new THREE.MeshStandardMaterial({ color: "#bfa374", roughness: 0.65, metalness: 0.2 });
    const green = new THREE.MeshStandardMaterial({ color: "#364e2e", roughness: 0.65, metalness: 0.25 });
    const potion = new THREE.MeshStandardMaterial({ color: "#38bdf8", emissive: "#0284c7", emissiveIntensity: 0.8, roughness: 0.15 });
    const flash = new THREE.MeshBasicMaterial({ color: "#fff2b0", transparent: true, opacity: 0 });
    return { suit, trim, accent, visor, gun, wood, chrome, tan, green, potion, flash };
  }, [color, skin.suit, skin.trim, skin.visor]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    g.visible = actor.alive;
    const scale = actor.height / MOVE.height;
    g.position.set(actor.x, actor.y, actor.z);
    g.rotation.y = actor.yaw + spin;
    const k = FIGHTER.proceduralScale;
    g.scale.set(k, scale * k, k);

    const run = Math.min(1, actor.speed / MOVE.walkSpeed);
    const t = actor.animTime * 6;
    const swing = Math.sin(t) * 0.85 * run;
    const airborne = !actor.grounded;

    if (legL.current && legR.current) {
      if (airborne) {
        legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, actor.vy > 0 ? -0.7 : 0.35, 1 - Math.exp(-12 * dt));
        legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, actor.vy > 0 ? 0.4 : -0.2, 1 - Math.exp(-12 * dt));
      } else {
        legL.current.rotation.x = swing;
        legR.current.rotation.x = -swing;
      }
    }
    if (armL.current && armR.current && torso.current && head.current) {
      const aim = -actor.pitch;
      const kick = actor.shootAnim * 0.5;
      const reload = actor.reloadAnim;
      const armBob = Math.sin(t) * 0.05 * run;

      // Right arm: holds the pistol grip with natural inward cant
      armR.current.rotation.x = aim - 1.35 + kick + reload * 0.9 + armBob;
      armR.current.rotation.y = -0.22;
      armR.current.rotation.z = -0.12 + (airborne ? -0.1 : 0);

      // Left arm: reaches across torso supporting weapon barrel
      armL.current.rotation.x = aim - 1.25 + kick * 0.7 + reload * 1.4 + armBob;
      armL.current.rotation.y = 0.46;
      armL.current.rotation.z = 0.35 - reload * 0.6 + (airborne ? 0.12 : 0);

      // Torso & head natural motion
      torso.current.position.y = 0.9 + Math.abs(Math.sin(t)) * 0.045 * run;
      torso.current.rotation.x = actor.pitch * 0.25;
      torso.current.rotation.y = Math.sin(t * 0.5) * 0.06 * run;
      head.current.rotation.x = actor.pitch * 0.7;
    }
    if (muzzle.current) {
      (muzzle.current.material as THREE.MeshBasicMaterial).opacity = actor.shootAnim;
      muzzle.current.scale.setScalar(0.6 + actor.shootAnim * 0.9);
    }
  });

  return (
    <group ref={root}>
      {/* legs */}
      <group ref={legL} position={[-0.16, 0.82, 0]}>
        <mesh position={[0, -0.41, 0]} material={mats.suit} castShadow={shadows}>
          <boxGeometry args={[0.22, 0.82, 0.24]} />
        </mesh>
        <mesh position={[0, -0.82, 0.03]} material={mats.accent} castShadow={shadows}>
          <boxGeometry args={[0.24, 0.1, 0.3]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.16, 0.82, 0]}>
        <mesh position={[0, -0.41, 0]} material={mats.suit} castShadow={shadows}>
          <boxGeometry args={[0.22, 0.82, 0.24]} />
        </mesh>
        <mesh position={[0, -0.82, 0.03]} material={mats.accent} castShadow={shadows}>
          <boxGeometry args={[0.24, 0.1, 0.3]} />
        </mesh>
      </group>

      {/* torso */}
      <group ref={torso} position={[0, 0.9, 0]}>
        <mesh material={mats.suit} castShadow={shadows}>
          <boxGeometry args={[0.56, 0.62, 0.34]} />
        </mesh>
        <mesh position={[0, 0.05, -0.19]} material={mats.accent} castShadow={shadows}>
          <boxGeometry args={[0.4, 0.4, 0.06]} />
        </mesh>
        <mesh position={[0, 0.12, 0.19]} material={mats.accent}>
          <boxGeometry args={[0.2, 0.12, 0.04]} />
        </mesh>
        <mesh position={[-0.36, 0.26, 0]} material={mats.trim} castShadow={shadows}>
          <boxGeometry args={[0.2, 0.16, 0.34]} />
        </mesh>
        <mesh position={[0.36, 0.26, 0]} material={mats.trim} castShadow={shadows}>
          <boxGeometry args={[0.2, 0.16, 0.34]} />
        </mesh>

        {/* head */}
        <group ref={head} position={[0, 0.52, 0]}>
          <mesh material={mats.suit} castShadow={shadows}>
            <boxGeometry args={[0.34, 0.34, 0.34]} />
          </mesh>
          <mesh position={[0, 0.02, -0.18]} material={mats.visor}>
            <boxGeometry args={[0.3, 0.14, 0.04]} />
          </mesh>
        </group>

        {/* arms + weapon */}
        <group ref={armL} position={[-0.36, 0.2, 0]}>
          <mesh position={[0, -0.28, -0.1]} material={mats.suit} castShadow={shadows}>
            <boxGeometry args={[0.16, 0.58, 0.16]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.36, 0.2, 0]}>
          <mesh position={[0, -0.28, -0.1]} material={mats.suit} castShadow={shadows}>
            <boxGeometry args={[0.16, 0.58, 0.16]} />
          </mesh>
          <group position={[-0.16, -0.5, -0.42]}>
            <WeaponProp weaponId={weaponId} shadows={shadows} />
            <mesh ref={muzzle} position={[0, 0, -0.52]} material={mats.flash}>
              <sphereGeometry args={[0.14, 8, 8]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export function EnemyFighter({ shadows, skin }: { shadows: boolean; skin: Skin }) {
  return <Fighter actor={engine.bot} shadows={shadows} skin={skin} />;
}


/**
 * Sniper scope glint: a sniping enemy flashes a small lens flare at eye
 * height, so you can spot them at long range like in Fortnite.
 */
function ScopeGlint({ actor }: { actor: Actor }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#dff4ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.CircleGeometry(0.5, 16), []);

  useFrame(({ clock, camera }) => {
    const g = group.current;
    if (!g) return;
    const a = Math.max(0, Math.min(1, actor.glint));
    const on = actor.alive && a > 0.02;
    g.visible = on;
    if (!on) return;
    const pulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 7);
    mat.opacity = a * (0.35 + 0.55 * pulse);
    const s = 0.34 + a * 0.3 * pulse;
    g.scale.setScalar(s);
    g.position.set(actor.x, actor.y + actor.height - 0.14, actor.z);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

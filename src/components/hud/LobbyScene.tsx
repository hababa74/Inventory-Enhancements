import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Fighter } from "../game/Fighter";
import { MOVE } from "../../game/constants";
import type { Actor } from "../../game/engine";
import type { Skin } from "../../game/skins";
import { useHud } from "../../game/store";

import type { WeaponId } from "../../game/constants";

function makeDummy(): Actor {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    shield: 50,
    alive: true,
    grounded: true,
    crouching: false,
    height: MOVE.height,
    speed: 0,
    animTime: 0,
    shootAnim: 0,
    reloadAnim: 0,
  } as Actor;
}

function Podium({ skin, weaponId }: { skin: Skin; weaponId?: WeaponId }) {
  const dummy = useMemo(makeDummy, []);
  const spin = useRef(0);
  const ring = useRef<THREE.Mesh>(null);
  const hudWeapon = useHud((s) => s.weapon);
  const held = weaponId ?? hudWeapon ?? "rifle";

  useFrame((_, dt) => {
    spin.current += dt * 0.35;
    dummy.animTime += dt * 0.5;
    dummy.yaw = spin.current;
    if (ring.current) ring.current.rotation.y -= dt * 0.6;
  });

  return (
    <group position={[0, -0.9, 0]}>
      <Fighter actor={dummy} shadows={false} skin={skin} weaponId={held} />
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.35, 0.12, 48]} />
        <meshStandardMaterial color="#151c28" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh ref={ring} position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.34, 64, 1, 0, Math.PI * 1.4]} />
        <meshBasicMaterial color={skin.accent} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.16, 48]} />
        <meshBasicMaterial color={skin.accent} transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

export function LobbyScene({ skin, weaponId }: { skin: Skin; weaponId?: WeaponId }) {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.15, 6.1], fov: 31 }}
      onCreated={({ scene, camera }) => {
        scene.fog = new THREE.Fog("#070b12", 6, 18);
        camera.lookAt(0, 0.12, 0);
      }}
    >
      <color attach="background" args={["#070b12"]} />
      <hemisphereLight args={["#bfe2ff", "#26303f", 1.4]} />
      <ambientLight intensity={1.1} />
      <pointLight position={[1.6, 1.8, 3.2]} intensity={40} color="#ffffff" distance={12} />
      <directionalLight position={[4, 6, 3]} intensity={2.4} color="#ffe9c9" />
      <pointLight position={[-3, 1.6, 2]} intensity={26} color={skin.accent} distance={14} />
      <pointLight position={[3, 2.2, -2]} intensity={22} color="#6ea8ff" distance={14} />
      <Podium skin={skin} weaponId={weaponId} />
      <mesh position={[0, -0.92, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[40, 40, "#1d3346", "#111a26"]} position={[0, -0.91, 0]} />
    </Canvas>
  );
}

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Fighter } from "../game/Fighter";
import { MOVE } from "../../game/constants";
import type { Actor } from "../../game/engine";
import type { Skin } from "../../game/skins";

export const RARITY_COLOR: Record<Skin["rarity"], string> = {
  Standard: "#8ba0b8",
  Selten: "#4fa8ff",
  Episch: "#c86bff",
  "Legendär": "#ffb02e",
};

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

function Model({ skin, spinning, scale, offsetY }: { skin: Skin; spinning: boolean; scale: number; offsetY: number }) {
  const dummy = useMemo(makeDummy, []);
  const spin = useRef(-0.35);

  useFrame((_, dt) => {
    if (spinning) spin.current += dt * 0.6;
    dummy.animTime += dt * 0.5;
    dummy.yaw = spin.current;
  });

  return (
    <group position={[0, -0.95 + offsetY, 0]} scale={scale}>
      <Fighter actor={dummy} shadows={false} skin={skin} />
    </group>
  );
}

/** small rotating 3D bust of a fighter — used for locker / shop cards */
export function SkinPortrait({
  skin,
  className = "",
  fov = 26,
  scale = 0.85,
  offsetY = 0,
}: {
  skin: Skin;
  className?: string;
  fov?: number;
  scale?: number;
  offsetY?: number;
}) {
  const [hover, setHover] = useState(false);
  const color = RARITY_COLOR[skin.rarity];

  if (skin.art) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(120% 90% at 50% 12%, ${color}44 0%, #0a0f18 62%, #05080d 100%)`,
        }}
      >
        <img
          src={skin.art}
          alt={`${skin.name} Skin`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain object-bottom"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          style={{ background: "linear-gradient(to top, rgba(3,6,11,0.92), transparent)" }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        background: `radial-gradient(120% 90% at 50% 12%, ${color}44 0%, #0a0f18 62%, #05080d 100%)`,
      }}
    >

      <Canvas
        className="absolute inset-0"
        dpr={1}
        gl={{ antialias: false, powerPreference: "low-power" }}
        camera={{ position: [0, 0.1, 4.6], fov }}
        onCreated={({ camera }) => camera.lookAt(0, -0.18, 0)}
      >
        <hemisphereLight args={["#cfe6ff", "#1b2230", 1.5]} />
        <ambientLight intensity={1.0} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} color="#ffe9c9" />
        <pointLight position={[-2.4, 1.2, 2.2]} intensity={18} color={skin.accent} distance={12} />
        <pointLight position={[2.2, 1.6, -1.6]} intensity={14} color="#6ea8ff" distance={12} />
        <Model skin={skin} spinning={hover} scale={scale} offsetY={offsetY} />
        <mesh position={[0, -0.95 + offsetY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      </Canvas>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
        style={{ background: "linear-gradient(to top, rgba(3,6,11,0.92), transparent)" }}
      />
    </div>
  );
}

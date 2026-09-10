import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";
import { useHud } from "../../game/store";

export function StormZone() {
  const gameMode = useHud((s) => s.gameMode);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (gameMode !== "zonewars") return;
    const radius = engine.stormRadius;
    const pulse = Math.sin(clock.elapsedTime * 2) * 0.4 + 0.6;

    if (outerRef.current) {
      outerRef.current.scale.set(radius, 1, radius);
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + pulse * 0.06;
    }
    if (innerRef.current) {
      innerRef.current.scale.set(radius, 1, radius);
      (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.15;
    }
  });

  if (gameMode !== "zonewars") return null;

  return (
    <group>
      {/* Storm fill - large purple cylinder covering the outside */}
      <mesh ref={outerRef} position={[engine.stormCenterX, 25, engine.stormCenterZ]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1, 1, 50, 48, 1, true]} />
        <meshBasicMaterial
          color="#6b21a8"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* Storm edge ring - bright glowing edge */}
      <mesh ref={innerRef} position={[engine.stormCenterX, 0, engine.stormCenterZ]}>
        <cylinderGeometry args={[1, 1, 60, 48, 1, true]} />
        <meshBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
          wireframe={false}
        />
      </mesh>
      {/* Storm ground fog */}
      <mesh position={[engine.stormCenterX, 0.05, engine.stormCenterZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 200, 48]} />
        <meshBasicMaterial
          color="#581c87"
          transparent
          opacity={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

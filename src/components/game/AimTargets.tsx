import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";

const MAX = 12;

/** Floating aim-training targets — driven imperatively from the engine. */
export function AimTargets() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const targets = engine.aim.targets;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < MAX; i++) {
      const mesh = g.children[i] as THREE.Mesh | undefined;
      if (!mesh) continue;
      const tg = targets[i];
      if (!tg || !engine.aim.active) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const pop = 0.35 + 0.65 * tg.born;
      mesh.position.set(tg.x, tg.y + Math.sin(t * 1.6 + tg.id) * 0.12, tg.z);
      mesh.scale.setScalar(tg.r * pop);
      mesh.rotation.y = t * 0.8;
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: MAX }, (_, i) => (
        <mesh key={i} visible={false} castShadow={false}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial
            color="#ff5470"
            emissive="#ff2d55"
            emissiveIntensity={1.4}
            roughness={0.35}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

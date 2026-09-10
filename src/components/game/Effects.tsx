import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";

const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const quat = new THREE.Quaternion();

/** Pooled tracers + impact sparks + rockets + arrows + smoke trails. No allocations per shot. */
export function Effects({ enabled }: { enabled: boolean }) {
  const tracerRefs = useRef<THREE.Mesh[]>([]);
  const impactRefs = useRef<THREE.Mesh[]>([]);
  const rocketRefs = useRef<THREE.Group[]>([]);
  const arrowRefs = useRef<THREE.Group[]>([]);
  const smokeRefs = useRef<THREE.Mesh[]>([]);

  const {
    tracerGeo,
    tracerMats,
    impactGeo,
    impactMat,
    rocketBodyGeo,
    rocketTipGeo,
    rocketMat,
    rocketTipMat,
    flameGeo,
    flameMat,
    arrowShaftGeo,
    arrowTipGeo,
    arrowWoodMat,
    arrowTipMat,
    arrowFeatherMat,
    smokeGeo,
    smokeMat,
  } = useMemo(() => {
    const tracerGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true);
    tracerGeo.translate(0, 0.5, 0);
    const tracerMats = [
      new THREE.MeshBasicMaterial({ color: "#9ef7ff", transparent: true, opacity: 0.85, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: "#ffb0b0", transparent: true, opacity: 0.85, toneMapped: false }),
    ];
    const impactGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const impactMat = new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: true, opacity: 1, toneMapped: false });
    const rocketBodyGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.5, 8);
    rocketBodyGeo.rotateX(Math.PI / 2);
    const rocketTipGeo = new THREE.ConeGeometry(0.085, 0.28, 8);
    rocketTipGeo.rotateX(-Math.PI / 2);
    const rocketMat = new THREE.MeshStandardMaterial({ color: "#e8c463", metalness: 0.8, roughness: 0.35 });
    const rocketTipMat = new THREE.MeshStandardMaterial({ color: "#1b1f28", metalness: 0.5, roughness: 0.5 });
    const flameGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: "#ffb040", transparent: true, opacity: 0.9, toneMapped: false });

    // Arrow geometry & materials
    const arrowShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6);
    arrowShaftGeo.rotateX(Math.PI / 2);
    const arrowTipGeo = new THREE.ConeGeometry(0.035, 0.12, 6);
    arrowTipGeo.rotateX(-Math.PI / 2);
    const arrowWoodMat = new THREE.MeshStandardMaterial({ color: "#8b5a2b", roughness: 0.8 });
    const arrowTipMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8 });
    const arrowFeatherMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });

    // RPG Smoke trail
    const smokeGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const smokeMat = new THREE.MeshBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.45, depthWrite: false });

    return {
      tracerGeo,
      tracerMats,
      impactGeo,
      impactMat,
      rocketBodyGeo,
      rocketTipGeo,
      rocketMat,
      rocketTipMat,
      flameGeo,
      flameMat,
      arrowShaftGeo,
      arrowTipGeo,
      arrowWoodMat,
      arrowTipMat,
      arrowFeatherMat,
      smokeGeo,
      smokeMat,
    };
  }, []);

  useFrame(() => {
    engine.tracers.forEach((t, i) => {
      const m = tracerRefs.current[i];
      if (!m) return;
      m.visible = enabled && t.active;
      if (!t.active) return;
      dir.set(t.x2 - t.x1, t.y2 - t.y1, t.z2 - t.z1);
      const len = dir.length();
      if (len < 0.01) {
        m.visible = false;
        return;
      }
      dir.normalize();
      quat.setFromUnitVectors(up, dir);
      m.position.set(t.x1, t.y1, t.z1);
      m.quaternion.copy(quat);
      m.scale.set(1, len, 1);
      m.material = tracerMats[t.color === 0x9ef7ff ? 0 : 1]!;
    });
    engine.rockets.forEach((r, i) => {
      const g = rocketRefs.current[i];
      if (!g) return;
      g.visible = enabled && r.active;
      if (!r.active) return;
      dir.set(r.dx, r.dy, r.dz).normalize();
      quat.setFromUnitVectors(up, dir);
      g.position.set(r.x, r.y, r.z);
      g.quaternion.copy(quat);
      g.rotateX(Math.PI / 2);
    });
    engine.arrows.forEach((ar, i) => {
      const g = arrowRefs.current[i];
      if (!g) return;
      g.visible = enabled && ar.active;
      if (!ar.active) return;
      dir.set(ar.dx, ar.dy, ar.dz).normalize();
      quat.setFromUnitVectors(up, dir);
      g.position.set(ar.x, ar.y, ar.z);
      g.quaternion.copy(quat);
      g.rotateX(Math.PI / 2);
    });
    engine.smokeParticles.forEach((sp, i) => {
      const m = smokeRefs.current[i];
      if (!m) return;
      m.visible = enabled && sp.active;
      if (!sp.active) return;
      m.position.set(sp.x, sp.y, sp.z);
      m.scale.setScalar(Math.max(0.1, sp.scale));
    });
    engine.impacts.forEach((im, i) => {
      const m = impactRefs.current[i];
      if (!m) return;
      m.visible = enabled && im.active;
      if (!im.active) return;
      m.position.set(im.x, im.y, im.z);
      const s = 0.4 + (1 - im.life / 0.35) * 1.2;
      m.scale.setScalar(s);
    });
  });

  return (
    <group>
      {engine.tracers.map((_, i) => (
        <mesh
          key={`t${i}`}
          geometry={tracerGeo}
          material={tracerMats[0]!}
          visible={false}
          ref={(m) => {
            if (m) tracerRefs.current[i] = m;
          }}
        />
      ))}
      {engine.rockets.map((_, i) => (
        <group
          key={`r${i}`}
          visible={false}
          ref={(g) => {
            if (g) rocketRefs.current[i] = g;
          }}
        >
          <mesh geometry={rocketBodyGeo} material={rocketMat} />
          <mesh geometry={rocketTipGeo} material={rocketTipMat} position={[0, 0, -0.35]} />
          <mesh geometry={flameGeo} material={flameMat} position={[0, 0, 0.34]} scale={[0.7, 0.7, 1.6]} />
          <pointLight color="#ffa845" intensity={16} distance={9} />
        </group>
      ))}
      {engine.arrows.map((_, i) => (
        <group
          key={`ar${i}`}
          visible={false}
          ref={(g) => {
            if (g) arrowRefs.current[i] = g;
          }}
        >
          <mesh geometry={arrowShaftGeo} material={arrowWoodMat} />
          <mesh geometry={arrowTipGeo} material={arrowTipMat} position={[0, 0, -0.38]} />
          <mesh geometry={arrowTipGeo} material={arrowFeatherMat} position={[0, 0, 0.32]} scale={[0.8, 0.8, 1.2]} />
        </group>
      ))}
      {engine.smokeParticles.map((_, i) => (
        <mesh
          key={`sp${i}`}
          geometry={smokeGeo}
          material={smokeMat}
          visible={false}
          ref={(m) => {
            if (m) smokeRefs.current[i] = m;
          }}
        />
      ))}
      {engine.impacts.map((_, i) => (
        <mesh
          key={`i${i}`}
          geometry={impactGeo}
          material={impactMat}
          visible={false}
          ref={(m) => {
            if (m) impactRefs.current[i] = m;
          }}
        />
      ))}
    </group>
  );
}

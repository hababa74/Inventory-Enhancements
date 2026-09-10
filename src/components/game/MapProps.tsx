import { useMemo } from "react";
import * as THREE from "three";
import type { MapProp } from "../../game/arena";

/**
 * Scenery renderer for nature maps (desert trees, cacti, rocks, dunes).
 * Everything is drawn with instanced meshes so a few hundred props stay cheap.
 */

type Batch = {
  key: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  shadow: boolean;
};

export function MapProps({ props: items, shadows }: { props: MapProp[]; shadows: boolean }) {
  const batches = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.26, 0.42, 1, 7);
    const leaf = new THREE.ConeGeometry(0.5, 1, 5, 1, true);
    const canopy = new THREE.SphereGeometry(1, 8, 6);
    const cactusBody = new THREE.CapsuleGeometry(0.42, 1.6, 4, 8);
    const cactusArm = new THREE.CapsuleGeometry(0.24, 0.9, 4, 6);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const duneGeo = new THREE.SphereGeometry(1, 12, 8);
    const tuftGeo = new THREE.ConeGeometry(0.16, 0.8, 4, 1, true);

    const mat = (color: string, roughness = 0.92, flat = true) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: flat });

    const barkMat = mat("#7a5a3a");
    const palmLeafMat = mat("#4f8a3a", 0.85);
    const acaciaMat = mat("#6e8f45", 0.9);
    const cactusMat = mat("#3f7d4c", 0.8);
    const rockMat = mat("#9c8567");
    const duneMat = mat("#cfa76c", 1);
    const tuftMat = mat("#a9974f", 1);

    const out: Batch[] = [];
    const push = (key: string, geometry: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      const bt: Batch = { key, geometry, material, matrices: [], shadow };
      out.push(bt);
      return bt;
    };

    const bTrunk = push("trunk", trunk, barkMat, true);
    const bPalmLeaf = push("palmleaf", leaf, palmLeafMat, true);
    const bCanopy = push("canopy", canopy, acaciaMat, true);
    const bCactus = push("cactus", cactusBody, cactusMat, true);
    const bArm = push("cactusarm", cactusArm, cactusMat, true);
    const bRock = push("rock", rockGeo, rockMat, true);
    const bDune = push("dune", duneGeo, duneMat, false);
    const bTuft = push("tuft", tuftGeo, tuftMat, false);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const add = (
      batch: Batch,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      pos.set(x, y, z);
      scl.set(sx, sy, sz);
      batch.matrices.push(m.clone().compose(pos, q, scl));
    };

    for (const p of items) {
      const s = p.s;
      if (p.kind === "palm") {
        const h = 6.4 * s;
        add(bTrunk, p.x, h / 2, p.z, s, h, s, 0, p.rot, 0);
        for (let i = 0; i < 7; i++) {
          const a = p.rot + (i / 7) * Math.PI * 2;
          add(
            bPalmLeaf,
            p.x + Math.cos(a) * 1.5 * s,
            h + 0.1 * s,
            p.z + Math.sin(a) * 1.5 * s,
            1.5 * s,
            3.4 * s,
            0.5 * s,
            Math.PI * 0.42,
            -a,
            0,
          );
        }
      } else if (p.kind === "acacia") {
        const h = 4.8 * s;
        add(bTrunk, p.x, h / 2, p.z, s * 1.1, h, s * 1.1, 0, p.rot, 0);
        add(bCanopy, p.x, h + 0.6 * s, p.z, 2.9 * s, 1.2 * s, 2.9 * s, 0, p.rot, 0);
        add(bCanopy, p.x + 1.4 * s, h - 0.4 * s, p.z - 0.8 * s, 1.7 * s, 0.9 * s, 1.7 * s, 0, p.rot, 0);
      } else if (p.kind === "cactus") {
        const h = 3.4 * s;
        add(bCactus, p.x, h / 2, p.z, s, s, s, 0, p.rot, 0);
        add(bArm, p.x + 0.75 * s, h * 0.62, p.z, s, s, s, 0, p.rot, Math.PI * 0.42);
        add(bArm, p.x - 0.75 * s, h * 0.45, p.z, s, s, s, 0, p.rot, -Math.PI * 0.42);
      } else if (p.kind === "rock") {
        add(bRock, p.x, 0.55 * s, p.z, 1.5 * s, 1.1 * s, 1.4 * s, p.rot * 0.2, p.rot, p.rot * 0.15);
      } else if (p.kind === "dune") {
        add(bDune, p.x, -0.4 * s, p.z, 6.4 * s, 2.1 * s, 5.4 * s, 0, p.rot, 0);
      } else {
        for (let i = 0; i < 4; i++) {
          const a = p.rot + i * 1.6;
          add(
            bTuft,
            p.x + Math.cos(a) * 0.4 * s,
            0.35 * s,
            p.z + Math.sin(a) * 0.4 * s,
            s,
            s,
            s,
            0.2 * Math.cos(a),
            a,
            0.2 * Math.sin(a),
          );
        }
      }
    }

    return out.filter((b) => b.matrices.length > 0);
  }, [items]);

  return (
    <group>
      {batches.map((b) => (
        <Instances key={b.key} batch={b} shadows={shadows} />
      ))}
    </group>
  );
}

function Instances({ batch, shadows }: { batch: Batch; shadows: boolean }) {
  const ref = useMemo(() => {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }, [batch]);

  ref.castShadow = shadows && batch.shadow;
  ref.receiveShadow = shadows;

  return <InstancedHost mesh={ref} />;
}

/** Attaches an imperative THREE object without R3F trying to set DOM-ish props on it. */
function InstancedHost({ mesh }: { mesh: THREE.InstancedMesh }) {
  return (
    <group
      ref={(g) => {
        if (g && mesh.parent !== g) g.add(mesh);
      }}
    />
  );
}

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { FIGHTER, MOVE } from "../../game/constants";
import { engine, type Actor } from "../../game/engine";
import type { Skin } from "../../game/skins";
import type { WeaponId } from "../../game/constants";
import { WeaponProp } from "./WeaponProp";

/** GLB-based fighter. Auto-scaled to ~1.8m and oriented to face the game forward (-Z). */
export function ModelFighter({
  actor,
  shadows,
  skin,
  spin = 0,
  weaponId,
}: {
  actor: Actor;
  shadows: boolean;
  skin: Skin;
  spin?: number;
  weaponId?: WeaponId | undefined;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(skin.model!);

  const model = useMemo(() => {
    // SkeletonUtils.clone keeps skinned meshes bound to their own skeleton copy;
    // scene.clone() would leave them invisible/deformed.
    const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
    // Recolor the shared rig per skin so the in-match fighter reads like the
    // locker art instead of every skin looking identical.
    // For the authentic "ogmodel", keep the GLB's original textures and materials intact.
    const isOg = skin.id === "ogmodel";
    const suit = new THREE.Color(skin.suit);
    const accent = new THREE.Color(skin.accent);
    const trim = new THREE.Color(skin.trim);
    let matIndex = 0;
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        mesh.frustumCulled = false;

        if (isOg) return;

        const wasArray = Array.isArray(mesh.material);
        const list = wasArray ? (mesh.material as THREE.Material[]) : [mesh.material as THREE.Material];
        const recolored = list.map((m) => {
          const src = m as THREE.MeshStandardMaterial;
          const next = src.clone() as THREE.MeshStandardMaterial;
          if (src.map) {
            next.map = src.map;
            next.color = new THREE.Color("#ffffff").lerp(accent, 0.2);
          } else {
            const pick = matIndex % 3 === 0 ? suit : matIndex % 3 === 1 ? accent : trim;
            matIndex++;
            next.color = pick.clone();
            next.roughness = 0.55;
            next.metalness = 0.28;
            if (pick === accent) {
              next.emissive = accent.clone();
              next.emissiveIntensity = 0.35;
            }
          }
          return next as THREE.Material;
        });
        mesh.material = wasArray ? recolored : recolored[0]!;
      }
    });

    clone.updateMatrixWorld(true);

    // Normalize scale/center so the model stands on the ground and is ~1.8m tall.
    const box = new THREE.Box3().setFromObject(clone, true);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetScale = FIGHTER.visualHeight / Math.max(size.y, 0.01);

    // Center horizontally and put the lowest point at y = 0 (local units).
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.set(clone.position.x - center.x, clone.position.y - box.min.y, clone.position.z - center.z);

    (globalThis as unknown as Record<string, unknown>)["__fighterDebug"] = {
      sizeY: size.y,
      sizeX: size.x,
      targetScale,
    };
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(targetScale);
    return wrapper;
  }, [scene, shadows, skin.suit, skin.accent, skin.trim]);

  // The export ships in a T-pose with no clips, so drive the rig procedurally.
  const rig = useMemo(() => {
    const find = (needle: string) => {
      let hit: THREE.Bone | undefined;
      model.traverse((o) => {
        if (hit) return;
        if ((o as THREE.Bone).isBone && o.name.includes(needle)) hit = o as THREE.Bone;
      });
      return hit ?? null;
    };
    const bones = {
      spine: find("Spine1_"),
      lArm: find("LeftArm_"),
      rArm: find("RightArm_"),
      lForeArm: find("LeftForeArm_"),
      rForeArm: find("RightForeArm_"),
      lLeg: find("LeftUpLeg_"),
      rLeg: find("RightUpLeg_"),
      lKnee: find("LeftLeg_"),
      rKnee: find("RightLeg_"),
    };
    const base = new Map<THREE.Bone, THREE.Quaternion>();
    for (const b of Object.values(bones)) if (b) base.set(b, b.quaternion.clone());
    return { bones, base };
  }, [model]);

  const hands = useRef<THREE.Group>(null);
  const tmpQ = useRef(new THREE.Quaternion());
  const tmpE = useRef(new THREE.Euler());

  const pose = (bone: THREE.Bone | null, x: number, y: number, z: number) => {
    if (!bone) return;
    const b = rig.base.get(bone);
    if (!b) return;
    tmpE.current.set(x, y, z);
    tmpQ.current.setFromEuler(tmpE.current);
    bone.quaternion.copy(b).multiply(tmpQ.current);
  };

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = actor.alive;
    const hScale = actor.height / MOVE.height;
    g.position.set(actor.x, actor.y, actor.z);
    // this export already faces -Z, matching the engine's yaw=0 forward direction.
    g.rotation.y = actor.yaw + spin;
    g.scale.setScalar(hScale);

    // arms down out of the T-pose, plus a walk/idle cycle from actor state
    const run = Math.min(1, actor.speed / MOVE.sprintSpeed);
    const t = actor.animTime * 8;
    const swing = Math.sin(t) * (0.15 + run * 0.5);
    const breathe = Math.sin(actor.animTime * 2) * 0.05;
    const air = actor.grounded ? 0 : 0.5;

    // Fortnite-style: weapon carried up in front, aim follows the pitch
    const aim = -actor.pitch * 0.7;
    const kick = actor.shootAnim * 0.35;
    const reload = actor.reloadAnim * 0.8;
    const drop = 1.24 - breathe - air * 0.25;
    const carry = Boolean(weaponId);
    if (carry) {
      // Tactical ready stance: both arms brought forward holding weapon in front of chest
      // Right arm: upper arm angles forward, forearm bends forward holding grip
      pose(rig.bones.rArm, -0.48 - swing * 0.2 + kick * 0.3 + reload * 0.4, -0.22, 1.08 - breathe * 0.04);
      pose(rig.bones.rForeArm, -1.22 + kick * 0.3 + reload * 0.5 + aim * 0.5, -0.15, 0.1);

      // Left arm: reaches across chest, forearm bends forward supporting barrel/foregrip
      pose(rig.bones.lArm, -0.55 + swing * 0.2 + kick * 0.2, 0.42, -0.98 + breathe * 0.04);
      pose(rig.bones.lForeArm, -1.28 + kick * 0.2 + reload * 1.1 + aim * 0.5, 0.32, -0.14);
    } else {
      // Natural idle/run pose with arms lowered at sides
      pose(rig.bones.lArm, swing * 0.35, 0, -(drop - 0.1));
      pose(rig.bones.rArm, -swing * 0.35, 0, drop - 0.1);
      pose(rig.bones.lForeArm, -0.15, 0, -0.05);
      pose(rig.bones.rForeArm, -0.15, 0, 0.05);
    }
    pose(rig.bones.lLeg, -swing * 1.2 - air * 0.6, 0, 0);
    pose(rig.bones.rLeg, swing * 1.2 - air * 0.3, 0, 0);
    pose(rig.bones.lKnee, Math.max(0, -swing) * 1.4 + air * 0.9, 0, 0);
    pose(rig.bones.rKnee, Math.max(0, swing) * 1.4 + air * 0.5, 0, 0);
    pose(rig.bones.spine, actor.crouching ? 0.2 : 0.03, 0, 0);

    // weapon rides naturally in hands in front of the chest, aiming with pitch
    const h = hands.current;
    if (h) {
      h.position.set(0.20, 1.08 + (actor.crouching ? -0.28 : 0), -0.32);
      h.rotation.set(-actor.pitch * 0.7 - 0.08, 0.04, 0);
    }
  });


  // A plain <group> hosts the cloned scene: applying JSX props (incl. dev-only
  // source attributes) directly onto a raw three object via <primitive> throws.
  return (
    <group ref={group}>
      <ModelHost object={model} />
      {weaponId && (
        <group ref={hands}>
          <WeaponProp weaponId={weaponId} shadows={shadows} />
        </group>
      )}
    </group>
  );
}

function ModelHost({ object }: { object: THREE.Object3D }) {
  const host = useRef<THREE.Group>(null);
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    h.add(object);
    return () => {
      h.remove(object);
    };
  }, [object]);
  return <group ref={host} />;
}

export function EnemyModelFighter({ shadows, skin }: { shadows: boolean; skin: Skin }) {
  return <ModelFighter actor={engine.bot} shadows={shadows} skin={skin} />;
}

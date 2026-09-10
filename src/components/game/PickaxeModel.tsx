import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import pickaxeAsset from "../../assets/fortnite-pickaxe.glb.asset.json";

export const PICKAXE_URL = pickaxeAsset.url;

/**
 * First-person pickaxe. The GLB is normalized so its longest axis points along
 * local +Y (the shaft direction the swing animation expects) and it is roughly
 * 0.9m long, matching the old procedural tool.
 */
export function PickaxeModel() {
  const { scene } = useGLTF(PICKAXE_URL);

  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
      }
    });
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clone, true);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.sub(center);

    // align the longest axis with +Y
    const align = new THREE.Group();
    align.add(clone);
    const longest = Math.max(size.x, size.y, size.z);
    if (longest === size.x) align.rotation.z = Math.PI / 2;
    else if (longest === size.z) align.rotation.x = -Math.PI / 2;

    const wrapper = new THREE.Group();
    wrapper.add(align);
    wrapper.scale.setScalar(0.9 / Math.max(longest, 0.001));
    return wrapper;
  }, [scene]);

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

useGLTF.preload(PICKAXE_URL);

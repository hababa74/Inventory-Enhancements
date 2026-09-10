import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ARENA, STATIC_BOXES, getMap } from "../../game/arena";
import { useSettings } from "../../game/store";
import { MapProps } from "./MapProps";

function makeGridTexture(size: number, cells: number, base: string, line: string, accent: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const step = size / cells;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);
  // subtle noise for material depth
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** big soft checkerboard like a mown pitch */
function makeCheckerTexture(size: number, a: string, b: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, size / 2, size / 2);
  ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function Arena({ shadows }: { shadows: boolean }) {
  const mapId = useSettings((s) => s.mapId);
  const map = getMap(mapId);
  const theme = map.theme;

  const { materials, boxGeo } = useMemo(() => {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    let ground: THREE.Material;
    if (theme.neon) {
      const floorTex = makeGridTexture(256, 4, theme.groundA, theme.groundLine, "#44586f");
      floorTex.repeat.set(13, 15);
      ground = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.12 });
    } else {
      const grassTex = makeCheckerTexture(128, theme.groundA, theme.groundB);
      grassTex.repeat.set(map.halfX / 5, map.halfZ / 5);
      ground = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 });
    }
    const panelTex = makeGridTexture(128, 2, "#38465c", "#4a5d78", "#5c73a1");
    panelTex.repeat.set(2, 2);
    const materials: Record<string, THREE.Material> = {
      ground,
      platform: new THREE.MeshStandardMaterial({
        map: panelTex,
        color: theme.structure ?? "#7f93ad",
        roughness: theme.structure ? 0.95 : 0.55,
        metalness: theme.structure ? 0 : 0.35,
      }),
      cover: new THREE.MeshStandardMaterial({
        color: theme.structure ?? "#5b6e8c",
        roughness: theme.structure ? 0.95 : 0.5,
        metalness: theme.structure ? 0 : 0.4,
      }),
      prop: new THREE.MeshBasicMaterial({ visible: false }),
      bounds: new THREE.MeshStandardMaterial({
        color: theme.neon ? "#0d1520" : theme.sky,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: theme.neon ? 0.92 : 0.25,
      }),
    };
    return { materials, boxGeo };
  }, [map.halfX, map.halfZ, theme]);

  useEffect(() => {
    return () => {
      boxGeo.dispose();
      Object.values(materials).forEach((m) => {
        if ("map" in m && m.map && m.map instanceof THREE.Texture) {
          m.map.dispose();
        }
        m.dispose();
      });
    };
  }, [boxGeo, materials]);

  return (
    <group>
      {map.props && map.props.length > 0 && <MapProps props={map.props} shadows={shadows} />}

      {STATIC_BOXES.filter((b) => b.kind !== "prop").map((b, i) => (
        <mesh
          key={`${mapId}-${i}`}
          geometry={boxGeo}
          material={materials[b.kind]!}
          position={[b.cx, b.cy, b.cz]}
          scale={[b.sx, b.sy, b.sz]}
          castShadow={shadows && b.kind !== "ground" && b.kind !== "bounds"}
          receiveShadow={shadows}
        />
      ))}

      {theme.neon && (
        <>
          {/* Neon edge strips for readability + arena identity */}
          {[-1, 1].map((s) => (
            <mesh key={`strip${s}`} position={[s * (ARENA.halfX - 0.1), 0.06, 0]}>
              <boxGeometry args={[0.25, 0.12, ARENA.halfZ * 2]} />
              <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`endstrip${s}`} position={[0, 0.06, s * (ARENA.halfZ - 0.1)]}>
              <boxGeometry args={[ARENA.halfX * 2, 0.12, 0.25]} />
              <meshStandardMaterial
                color={s < 0 ? "#3dff9e" : "#ff4d6d"}
                emissive={s < 0 ? "#3dff9e" : "#ff4d6d"}
                emissiveIntensity={2}
                toneMapped={false}
              />
            </mesh>
          ))}
          {/* Center marker */}
          <mesh position={[0, 5.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.4, 1.8, 40]} />
            <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* Spawn pads */}
      {map.spawns.map((sp, i) => (
        <mesh key={`spawn${i}`} position={[sp.x, 0.06, sp.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.5, 32]} />
          <meshStandardMaterial
            color={i === 0 ? "#3dff9e" : "#ff4d6d"}
            emissive={i === 0 ? "#3dff9e" : "#ff4d6d"}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* 1v1.lol style grid overlay on the ground for spatial awareness */}
      <gridHelper
        args={[80, 20, "#1a2535", "#1a2535"]}
        position={[0, 0.02, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

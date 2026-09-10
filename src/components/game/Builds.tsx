import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";
import { createPiece, getEditShapeInfo, pieceBounds, tileQuad } from "../../game/build";
import { MATS, type MatId } from "../../game/constants";

/** Renders every placed build piece straight from its collider boxes. */
export function Builds({ shadows }: { shadows: boolean }) {
  useSyncExternalStore(engine.subscribeBuilds, engine.getBuildVersion, () => 0);

  const { geo, mats, blueprintMat } = useMemo(() => {
    const res = makeBuildMaterials();
    const blueprintMat = new THREE.MeshBasicMaterial({
      color: "#00c3ff",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { ...res, blueprintMat };
  }, []);

  return (
    <group>
      <PieceHealthBars />
      {engine.pieceList.map((p) => {
        const isEditing = engine.editMode && engine.editPiece?.id === p.id;
        return p.colliders.map((c, i) => (
          <PieceMesh
            key={`${p.id}-${p.version}-${i}`}
            geo={geo}
            baseMat={mats[p.mat]}
            blueprintMat={blueprintMat}
            isEditing={isEditing}
            c={c}
            hp={p.hp}
            maxHp={p.maxHp}
            owner={p.owner}
            matId={p.mat}
            shadows={shadows}
          />
        ));
      })}
    </group>
  );
}

interface PieceMeshProps {
  geo: THREE.BoxGeometry;
  baseMat: THREE.MeshStandardMaterial;
  blueprintMat: THREE.MeshBasicMaterial;
  isEditing: boolean;
  c: import("../../game/math").AABB;
  hp: number;
  maxHp: number;
  owner: string;
  matId: import("../../game/constants").MatId;
  shadows: boolean;
}

function PieceMesh({
  geo,
  baseMat,
  blueprintMat,
  isEditing,
  c,
  hp,
  maxHp,
  owner,
  matId,
  shadows,
}: PieceMeshProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Clone the material once on mount and keep reusing it — never clone again per frame.
  const mat = useMemo(() => baseMat.clone(), [baseMat]);
  useEffect(() => {
    return () => {
      mat.dispose();
    };
  }, [mat]);

  // Update only the color property when damage/ownership changes (no clone needed).
  const f = Math.max(0, Math.min(1, hp / maxHp));
  const base = useMemo(() => {
    const b = new THREE.Color(MATS[matId].color).lerp(
      new THREE.Color(owner === "player" ? "#7fd7ff" : "#ff9aa8"),
      0.12,
    );
    return b.lerp(new THREE.Color("#2c1410"), (1 - f) * 0.6);
  }, [matId, owner, f]);

  mat.color.copy(base);

  return (
    <mesh
      geometry={geo}
      material={isEditing ? blueprintMat : mat}
      ref={matRef as unknown as React.Ref<THREE.Mesh>}
      castShadow={!isEditing && shadows}
      receiveShadow={!isEditing && shadows}
      position={[(c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, (c.minZ + c.maxZ) / 2]}
      scale={[
        Math.max(0.02, c.maxX - c.minX) * (hp / maxHp > 0.35 ? 1 : 0.94),
        Math.max(0.02, c.maxY - c.minY),
        Math.max(0.02, c.maxZ - c.minZ),
      ]}
    />
  );
}

/**
 * Fortnite / 1v1.LOL style edit overlay: the 3x3 grid is drawn directly on the
 * piece you are editing — aimed tile glows, marked tiles turn solid green,
 * already-open tiles read as dark holes.
 */
export function EditOverlay() {
  const group = useRef<THREE.Group>(null);
  const faces = useRef<THREE.Mesh[]>([]);
  const lines = useRef<THREE.LineSegments[]>([]);

  const { quad, edges, mats } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const edges = new THREE.EdgesGeometry(quad);
    const make = (color: string, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
    return {
      quad,
      edges,
      mats: {
        idle: make("#0077ff", 0.65), // Vibrant Fortnite blue
        aim: make("#38e1ff", 0.9), // Bright glowing cyan
        cut: make("#0f172a", 0.22), // Cut-out hole
        invalid: make("#ef4444", 0.85), // Warning red
      },
    };
  }, []);

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#38bdf8",
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = engine.editPiece;
    g.visible = engine.editMode && !!p;
    if (!g.visible || !p) return;

    const shapeInfo = getEditShapeInfo(p.type, engine.editSelection);
    const isValid = shapeInfo.valid;

    // Camera position for side-detection
    const camX = engine.camActive ? engine.camX : engine.player.x;
    const camY = engine.camActive ? engine.camY : engine.player.y + 1.6;
    const camZ = engine.camActive ? engine.camZ : engine.player.z;

    for (let i = 0; i < 9; i++) {
      const q = tileQuad(p, i);
      const m = faces.current[i];
      const l = lines.current[i];
      if (!m || !l) continue;
      if (!q) {
        m.visible = false;
        l.visible = false;
        continue;
      }
      const isSolid = engine.editSelection[i];
      const isAim = engine.editAimTile === i;

      m.visible = true;
      l.visible = true;

      if (!isValid) {
        m.material = mats.invalid;
      } else if (isAim) {
        m.material = mats.aim;
      } else if (isSolid) {
        m.material = mats.idle;
      } else {
        m.material = mats.cut;
      }

      const [nx, ny, nz] = q.normal;
      // Calculate dot product to camera to always render on the visible face
      const toCamX = camX - q.pos[0];
      const toCamY = camY - q.pos[1];
      const toCamZ = camZ - q.pos[2];
      const dot = toCamX * nx + toCamY * ny + toCamZ * nz;
      const side = dot >= 0 ? 1 : -1;
      const off = 0.045 * side;

      m.position.set(q.pos[0] + nx * off, q.pos[1] + ny * off, q.pos[2] + nz * off);
      m.rotation.set(q.rotX, q.rotY, 0);
      m.scale.set(q.size * 0.94, q.size * 0.94, 1);
      m.renderOrder = 998;

      l.position.copy(m.position);
      l.rotation.copy(m.rotation);
      l.scale.copy(m.scale);
      l.renderOrder = 999;
    }
  });

  return (
    <group ref={group} visible={false}>
      {Array.from({ length: 9 }).map((_, i) => (
        <group key={i}>
          <mesh
            geometry={quad}
            material={mats.idle}
            ref={(m) => {
              if (m) faces.current[i] = m;
            }}
          />
          <lineSegments
            geometry={edges}
            material={lineMat}
            ref={(l) => {
              if (l) lines.current[i] = l;
            }}
          />
        </group>
      ))}
    </group>
  );
}

/** Transparent placement preview, updated imperatively every frame. */
export function BuildGhost() {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const { geo, mats, matOk, matBad } = useMemo(() => {
    const build = makeBuildMaterials();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const makeGhost = (source: THREE.MeshStandardMaterial, color: string) =>
      new THREE.MeshBasicMaterial({
        map: source.map,
        color,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
    const matOk = makeGhost(build.mats.wood, "#a7f7d1");
    const matBad = makeGhost(build.mats.wood, "#ff6b7d");
    return {
      geo,
      mats: build.mats,
      matOk,
      matBad,
    };
  }, []);
  const ghostMaterials = useMemo(
    () =>
      ({
        wood: matOk,
        stone: new THREE.MeshBasicMaterial({
          map: mats.stone.map,
          color: "#b9c7d5",
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
        metal: new THREE.MeshBasicMaterial({
          map: mats.metal.map,
          color: "#bfeaff",
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
      }) as Record<MatId, THREE.MeshBasicMaterial>,
    [mats, matOk],
  );
  useEffect(() => {
    return () => {
      Object.values(ghostMaterials).forEach((material) => {
        if (material !== matOk) material.dispose();
      });
    };
  }, [ghostMaterials, matOk]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ghost = engine.ghost;
    g.visible = ghost.visible;
    if (!ghost.visible) return;
    const probe = createPiece(
      ghost.type,
      ghost.gx,
      ghost.gy,
      ghost.gz,
      ghost.rot,
      "player",
      engine.material,
    );
    const mat = ghost.valid ? ghostMaterials[engine.material] : matBad;
    meshes.current.forEach((m, i) => {
      const c = probe.colliders[i];
      if (!c) {
        m.visible = false;
        return;
      }
      m.visible = true;
      m.material = mat;
      m.position.set((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, (c.minZ + c.maxZ) / 2);
      m.scale.set(
        Math.max(0.02, c.maxX - c.minX),
        Math.max(0.02, c.maxY - c.minY),
        Math.max(0.02, c.maxZ - c.minZ),
      );
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={matOk}
          visible={false}
          ref={(m) => {
            if (m) meshes.current[i] = m;
          }}
        />
      ))}
    </group>
  );
}

/** Floating health bar over every structure, updated as it takes damage. */
function PieceHealthBars() {
  const group = useRef<THREE.Group>(null);
  const bg = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#08111a",
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    [],
  );

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((c) => c.quaternion.copy(camera.quaternion));
  });

  return (
    <group ref={group}>
      {engine.pieceList.map((p) => {
        const b = pieceBounds(p);
        const f = Math.max(0, Math.min(1, p.hp / p.maxHp));
        const color = f > 0.6 ? "#3dff9e" : f > 0.3 ? "#ffd166" : "#ff4d6d";
        return (
          <group
            key={`hp-${p.id}-${p.version}`}
            position={[(b.minX + b.maxX) / 2, b.maxY + 0.32, (b.minZ + b.maxZ) / 2]}
          >
            <mesh material={bg} position={[0, 0, -0.001]}>
              <planeGeometry args={[1.5, 0.2]} />
            </mesh>
            <mesh position={[-(1.42 * (1 - f)) / 2, 0, 0]}>
              <planeGeometry args={[1.42 * Math.max(0.001, f), 0.13]} />
              <meshBasicMaterial color={color} transparent depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Hand-built arena surfaces: woven branch walls, quarried stone blocks and
 * riveted sheet metal. The wood deliberately reads as a crafted survival
 * structure rather than a flat rectangular placeholder.
 */
function makeBuildMaterials() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tex = (draw: (c: CanvasRenderingContext2D, s: number) => void) => {
    const size = 256;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d")!;
    draw(ctx, size);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const rnd = (seed: number) => {
    let x = seed;
    return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  };

  const wood = tex((c, s) => {
    const r = rnd(7);
    c.fillStyle = "#6c482b";
    c.fillRect(0, 0, s, s);
    // dark backing so gaps between branches read as depth, not as a flat tile
    c.fillStyle = "rgba(22,18,15,0.42)";
    c.fillRect(10, 10, s - 20, s - 20);
    c.lineCap = "round";
    c.lineJoin = "round";
    // irregular woven branches
    for (let row = 0; row < 8; row++) {
      const y = 18 + row * 31 + (r() - 0.5) * 6;
      const sway = (r() - 0.5) * 10;
      c.strokeStyle = `rgb(${(112 + r() * 45) | 0},${(74 + r() * 34) | 0},${(38 + r() * 20) | 0})`;
      c.lineWidth = 10 + r() * 5;
      c.beginPath();
      c.moveTo(12, y);
      c.bezierCurveTo(s * 0.25, y + sway, s * 0.58, y - sway, s - 12, y + (r() - 0.5) * 8);
      c.stroke();
      c.strokeStyle = "rgba(231,177,92,0.32)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(16, y - 2);
      c.bezierCurveTo(s * 0.3, y + sway - 2, s * 0.6, y - sway - 2, s - 16, y - 2);
      c.stroke();
    }
    // vertical stakes and end caps
    c.strokeStyle = "#4c331f";
    c.lineWidth = 13;
    for (const x of [14, s - 14]) {
      c.beginPath();
      c.moveTo(x, 10);
      c.lineTo(x + (r() - 0.5) * 5, s - 10);
      c.stroke();
      c.strokeStyle = "rgba(224,170,88,0.42)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 2, 14);
      c.lineTo(x - 2, s - 14);
      c.stroke();
      c.strokeStyle = "#4c331f";
      c.lineWidth = 13;
    }
    // rope bindings at alternating joints
    for (const [x, y] of [
      [14, 26],
      [s - 14, 86],
      [s * 0.52, 116],
      [14, 202],
      [s - 14, 226],
    ]) {
      c.strokeStyle = "#d4a86e";
      c.lineWidth = 4;
      for (let band = -1; band <= 1; band++) {
        c.beginPath();
        c.arc(x, y + band * 5, 9, Math.PI * 0.25, Math.PI * 1.75);
        c.stroke();
      }
    }
    // subtle nails on the stakes
    c.fillStyle = "rgba(219,196,146,0.7)";
    for (const x of [14, s - 14]) {
      for (const y of [18, s * 0.5, s - 18]) {
        c.beginPath();
        c.arc(x - 2, y, 2.3, 0, Math.PI * 2);
        c.fill();
      }
    }
  });

  const stone = tex((c, s) => {
    const r = rnd(23);
    c.fillStyle = "#8d949c";
    c.fillRect(0, 0, s, s);
    const rows = 4;
    const h = s / rows;
    for (let i = 0; i < rows; i++) {
      const cols = 3;
      const off = (i % 2) * (s / cols / 2);
      for (let j = -1; j < cols + 1; j++) {
        const x = j * (s / cols) + off;
        const g = 130 + r() * 40;
        c.fillStyle = `rgb(${g | 0},${(g + 6) | 0},${(g + 12) | 0})`;
        c.fillRect(x + 2, i * h + 2, s / cols - 4, h - 4);
        c.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`;
        c.fillRect(x + 2, i * h + 2, s / cols - 4, 3);
      }
    }
    // speckles
    for (let i = 0; i < 500; i++) {
      c.fillStyle = `rgba(60,64,70,${r() * 0.3})`;
      c.fillRect(r() * s, r() * s, 2, 2);
    }
  });

  const metal = tex((c, s) => {
    const r = rnd(91);
    const grad = c.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, "#9fb6c2");
    grad.addColorStop(0.5, "#7d93a1");
    grad.addColorStop(1, "#93a9b6");
    c.fillStyle = grad;
    c.fillRect(0, 0, s, s);
    // brushed streaks
    for (let i = 0; i < 220; i++) {
      c.strokeStyle = `rgba(255,255,255,${r() * 0.07})`;
      c.beginPath();
      const y = r() * s;
      c.moveTo(0, y);
      c.lineTo(s, y + (r() - 0.5) * 3);
      c.stroke();
    }
    // panel seams + rivets
    c.strokeStyle = "rgba(40,52,60,0.75)";
    c.lineWidth = 3;
    c.strokeRect(6, 6, s - 12, s - 12);
    c.beginPath();
    c.moveTo(s / 2, 6);
    c.lineTo(s / 2, s - 6);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = 20 + i * ((s - 40) / 3);
        const y = 20 + j * ((s - 40) / 3);
        c.fillStyle = "rgba(220,232,240,0.55)";
        c.beginPath();
        c.arc(x, y, 3.4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(40,52,60,0.5)";
        c.beginPath();
        c.arc(x + 1, y + 1, 1.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  });

  const mats: Record<MatId, THREE.MeshStandardMaterial> = {
    wood: new THREE.MeshStandardMaterial({
      map: wood,
      color: "#d9b184",
      roughness: 0.82,
      metalness: 0.02,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: stone,
      color: "#c8ced4",
      roughness: 0.92,
      metalness: 0.04,
    }),
    metal: new THREE.MeshStandardMaterial({
      map: metal,
      color: "#cfe2ee",
      roughness: 0.38,
      metalness: 0.72,
    }),
  };
  return { geo, mats };
}

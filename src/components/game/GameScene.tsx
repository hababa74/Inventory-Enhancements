import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { engine } from "../../game/engine";
import { hudStore, settingsStore, useSettings } from "../../game/store";
import { Arena } from "./Arena";
import { getMap } from "../../game/arena";
import { Builds, BuildGhost, EditOverlay } from "./Builds";
import { Effects } from "./Effects";
import { AimTargets } from "./AimTargets";
import { Fighter } from "./Fighter";
import { ViewModel } from "./ViewModel";
import { TPS, WEAPONS } from "../../game/constants";
import { getSkin } from "../../game/skins";
import { StormZone } from "./StormZone";
import { useHud } from "../../game/store";

export function GameScene({
  shadows,
  effects,
  viewDistance,
}: {
  shadows: boolean;
  effects: boolean;
  viewDistance: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const light = useRef<THREE.DirectionalLight>(null);
  const killCamFrames = useHud((s) => s.killCamFrames);
  const killCamActive = useHud((s) => s.killCamActive);
  const enemySkin = getSkin(useHud((s) => s.opponentSkin));
  const ownSkin = getSkin(useSettings((s) => s.skin));
  const thirdPerson = useSettings((s) => s.thirdPerson);
  const hudScoped = useHud((s) => s.scoped);
  const hudWeapon = useHud((s) => s.weapon);
  // sniper scope takes over the whole screen, so drop to first person for it
  const scopeTakeover = hudScoped && !!WEAPONS[hudWeapon]?.scope;
  const tpsView = thirdPerson && !scopeTakeover;

  
  const theme = getMap(useSettings((s) => s.mapId)).theme;

  useEffect(() => {
    scene.fog = new THREE.Fog(theme.fog, viewDistance * 0.45, viewDistance);
    scene.background = new THREE.Color(theme.sky);
  }, [scene, viewDistance, theme]);

  // smoothed third person rig state (survives frames)
  const rig = useRef({ px: 0, py: 0, pz: 0, dist: TPS.distance, init: false });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const paused = hudStore.get().screen === "paused";
    if (!paused) engine.update(dt);

    // Kill-cam: position camera behind the opponent
    if (killCamActive && killCamFrames && killCamFrames.length > 0) {
      // The camera is driven by the KillCam component's frame index;
      // here we just ensure the camera stays positioned at the opponent's back
      const lastFrame = killCamFrames[killCamFrames.length - 1]!;
      const opyaw = lastFrame.byaw;
      // Position camera behind the opponent
      const camDist = 3.5;
      camera.position.set(
        lastFrame.bx + Math.sin(opyaw) * camDist,
        lastFrame.by + 1.6,
        lastFrame.bz + Math.cos(opyaw) * camDist,
      );
      camera.rotation.order = "YXZ";
      camera.rotation.y = opyaw + Math.PI; // facing the opponent's forward direction
      camera.rotation.x = -0.1;
      camera.rotation.z = 0;
      return; // Skip normal camera logic
    }

    const p = engine.player;
    const s = settingsStore.get();
    const shakeAmt = engine.shake * 0.03;
    let camX = p.x;
    let camY = engine.eyeY(p) + engine.viewOffsetY(p);
    let camZ = p.z;
    engine.camActive = false;

    const tps = s.thirdPerson && !(engine.scoped && WEAPONS[engine.weapon].scope);
    if (tps) {
      const cp = Math.cos(p.pitch);
      const fx = -Math.sin(p.yaw) * cp;
      const fy = Math.sin(p.pitch);
      const fz = -Math.cos(p.yaw) * cp;
      // right vector of the view (horizontal)
      const rx = -Math.cos(p.yaw);
      const rz = Math.sin(p.yaw);

      const building = engine.buildMode || engine.editMode;
      const aiming = engine.scoped;
      const side = aiming ? TPS.adsSide : TPS.side;
      const wantDist = aiming ? TPS.adsDistance : building ? TPS.buildDistance : TPS.distance;
      const pivotY = building ? TPS.buildPivotY : TPS.pivotY;

      // pivot follows the body with exponential smoothing (no jitter, no lag spikes)
      const crouch = p.crouching ? -0.32 : 0;
      const tx = p.x - rx * side;
      const ty = p.y + pivotY + crouch + engine.viewOffsetY(p);
      const tz = p.z - rz * side;
      const r = rig.current;
      if (!r.init) {
        r.px = tx;
        r.py = ty;
        r.pz = tz;
        r.dist = wantDist;
        r.init = true;
      }
      const k = 1 - Math.exp(-TPS.followRate * dt);
      r.px += (tx - r.px) * k;
      r.py += (ty - r.py) * k;
      r.pz += (tz - r.pz) * k;

      // keep the camera out of walls / builds, but never let it clip into the
      // fighter itself: a hard minimum keeps the whole body in frame
      const minDist = aiming ? 1.25 : 2.15;
      let dist = wantDist;
      const hit = engine.raycast(r.px, r.py + 0.1, r.pz, -fx, -fy, -fz, wantDist + 0.6, p, null);
      if (hit.hit !== "none") dist = Math.max(minDist, hit.dist - 0.35);
      const dk = 1 - Math.exp(-(dist < r.dist ? 40 : TPS.distanceRate) * dt);
      r.dist += (dist - r.dist) * dk;
      r.dist = Math.max(minDist, r.dist);


      camX = r.px - fx * r.dist;
      camY = r.py - fy * r.dist;
      camZ = r.pz - fz * r.dist;

      engine.camX = camX;
      engine.camY = camY;
      engine.camZ = camZ;
      engine.camActive = true;
    } else {
      rig.current.init = false;
    }

    camera.position.set(
      camX + (Math.random() - 0.5) * shakeAmt,
      camY + (Math.random() - 0.5) * shakeAmt,
      camZ + (Math.random() - 0.5) * shakeAmt,
    );
    camera.rotation.order = "YXZ";
    camera.rotation.y = p.yaw + engine.recoilYaw;
    camera.rotation.x = p.pitch + engine.recoilPitch;
    // view stays level: no sideways sway or lean while running
    camera.rotation.z = 0;

    const w = WEAPONS[engine.weapon];
    const targetFov = engine.scoped ? (w.scope ?? Math.max(35, s.fov - 22)) : s.fov;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
      camera.updateProjectionMatrix();
    }
    // scoped sniping must see (and shoot) far beyond the normal view distance
    const wantFar = engine.scoped && w.scope ? Math.max(viewDistance, w.range) : viewDistance;
    if (camera.far !== wantFar) {
      camera.far = wantFar;
      camera.updateProjectionMatrix();
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.near = wantFar * 0.6;
        fog.far = wantFar;
      }
    }

  }, -1);

  return (
    <>
      <hemisphereLight args={["#bfe2ff", "#2a3446", 1.15]} />
      <ambientLight intensity={0.75} />
      <directionalLight
        ref={light}
        position={[24, 42, 18]}
        intensity={2.6}
        color="#ffe9c9"
        castShadow={shadows}
        shadow-mapSize-width={shadows ? 2048 : 512}
        shadow-mapSize-height={shadows ? 2048 : 512}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={120}
        shadow-bias={-0.0006}
      />
      <pointLight position={[0, 14, -22]} intensity={90} color="#3dff9e" distance={45} />
      <pointLight position={[0, 14, 22]} intensity={90} color="#ff4d6d" distance={45} />
      <pointLight position={[0, 16, 0]} intensity={120} color="#8fd8ff" distance={60} />

      <Arena shadows={shadows} />
      <StormZone />
      <Builds shadows={shadows} />
      <BuildGhost />
      <EditOverlay />
      {/* own body only in third person: in first person it would sit inside the camera */}
      {tpsView && <Fighter actor={engine.player} shadows={shadows} skin={ownSkin} weaponId={hudWeapon} />}
      <Fighter actor={engine.bot} shadows={shadows} skin={enemySkin} weaponId="rifle" />
      {engine.extraBots.map((u, i) => (
        <Fighter key={i} actor={u.a} shadows={shadows} skin={enemySkin} weaponId="rifle" />
      ))}
      <AimTargets />
      <Effects enabled={effects} />
      {!tpsView && <ViewModel />}
    </>
  );
}

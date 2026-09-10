import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GameScene } from "./GameScene";
import { attachInput, input } from "../../game/input";
import { engine } from "../../game/engine";
import { useSettings } from "../../game/store";
import { patchDevSourceProps } from "../../lib/r3f-devprop-patch";

patchDevSourceProps();

function FrameDriver() {
  const advance = useThree((s) => s.advance);
  const limit = useSettings((s) => s.fpsLimit);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (limit > 0 && t - last < 1000 / limit - 0.7) return;
      last = t;
      advance(t / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advance, limit]);
  return null;
}

export function GameCanvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const quality = useSettings((s) => s.quality);
  const shadows = useSettings((s) => s.shadows);
  const effects = useSettings((s) => s.effects);
  const viewDistance = useSettings((s) => s.viewDistance);
  const fov = useSettings((s) => s.fov);

  useEffect(() => {
    if (!wrapper.current) return;
    (window as unknown as Record<string, unknown>)["__nexus"] = { engine, input };
    return attachInput(wrapper.current);
  }, []);

  const dpr: [number, number] = quality === "low" ? [0.7, 1] : quality === "medium" ? [1, 1.35] : [1, 2];

  return (
    <div ref={wrapper} className="absolute inset-0" tabIndex={-1}>
      <Canvas
        frameloop="never"
        shadows={shadows ? "soft" : false}
        dpr={dpr}
        camera={{ fov, near: 0.05, far: viewDistance, position: [0, 1.7, -24] }}
        gl={{
          antialias: quality !== "low",
          powerPreference: "high-performance",
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <FrameDriver />
        <GameScene shadows={shadows} effects={effects} viewDistance={viewDistance} />
      </Canvas>
    </div>
  );
}

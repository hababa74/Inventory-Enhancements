import * as THREE from "three";

/**
 * The dev tooling adds a `data-tsd-source` attribute to every JSX element.
 * react-three-fiber treats dashed props as nested paths, so it tries to write
 * `data["tsd-source"]` on the underlying three.js object and throws
 * `Cannot set "data-tsd-source"` — which blanks the whole scene on any update.
 *
 * Giving three.js objects a harmless `data` bucket makes that write a no-op.
 */
let patched = false;

/** Bottomless object: every nested dev-attribute path resolves harmlessly. */
function makeSink(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  return new Proxy(store, {
    get(t, k: string) {
      if (!(k in t)) t[k] = makeSink();
      return t[k];
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
}

export function patchDevSourceProps() {
  if (patched) return;
  patched = true;
  (globalThis as unknown as Record<string, unknown>)["__devPropPatch"] = true;
  const targets = [
    THREE.Object3D.prototype,
    THREE.Material.prototype,
    THREE.BufferGeometry.prototype,
  ] as unknown as Array<Record<string, unknown>>;
  for (const proto of targets) {
    if ("data" in proto) continue;
    Object.defineProperty(proto, "data", {
      configurable: true,
      get() {
        if (!this.__devPropBucket) {
          Object.defineProperty(this, "__devPropBucket", {
            value: makeSink(),
            enumerable: false,
            writable: true,
          });
        }
        return this.__devPropBucket;
      },
      set() {
        /* ignore */
      },
    });
  }
}

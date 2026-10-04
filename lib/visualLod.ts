import type * as THREE from 'three';

/** Estado visual por personaje; no interviene en movimiento ni interacción. */
export interface VisualLod {
  elapsed: number;
  visible: boolean;
}

/** Ocultación donde empieza la niebla (55 m): visibles bajo 60 m de profundidad, ocultos sobre 66 m (histéresis). */
export function animationStep(
  lod: VisualLod,
  camera: THREE.Camera,
  position: THREE.Vector3,
  dt: number,
  force = false,
): number {
  const e = camera.matrixWorldInverse.elements;
  const depth = -(e[2] * position.x + e[6] * (position.y + 1) + e[10] * position.z + e[14]);
  const distance = camera.position.distanceTo(position);
  const wasVisible = lod.visible;
  lod.elapsed += dt;
  lod.visible = force || depth < (wasVisible ? 66 : 60);
  if (!lod.visible) {
    lod.elapsed = 0;
    return 0;
  }
  const period = force || distance < 55 ? 0 : distance < 95 ? 0.1 : 0.2;
  if (wasVisible && lod.elapsed < period) return 0;
  const step = Math.min(lod.elapsed, 0.2);
  lod.elapsed = 0;
  return step;
}

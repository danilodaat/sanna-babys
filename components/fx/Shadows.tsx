'use client';

import { useEffect, useMemo, useRef, type Ref } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRenderQuality } from './AdaptiveQuality';

/*
 * Sombras independientes de resolución y bloom:
 *  - activas: el shadow map se recalcula cada 2 frames
 *    (30 actualizaciones/s si el render alcanza 60 FPS)
 *  - apagadas: cada personaje conserva su sombra redonda simple (<BlobShadow />)
 */
export function ShadowQuality() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const shadows = useRenderQuality((s) => s.shadows);
  const frame = useRef(0);

  useEffect(() => {
    const on = shadows;
    gl.shadowMap.enabled = on;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    // Cambiar shadowMap.enabled obliga a recompilar los materiales
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
    });
  }, [shadows, gl, scene]);

  useFrame(() => {
    if (shadows && frame.current++ % 2 === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

const blobGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
const blobTex = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(40,20,50,0.55)');
  g.addColorStop(1, 'rgba(40,20,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false });

/** Sombra barata; always la conserva en alto para modelos sin castShadow. */
export function BlobShadow({ scale = 1, always = false, meshRef }: { scale?: number; always?: boolean; meshRef?: Ref<THREE.Mesh> }) {
  const shadows = useRenderQuality((s) => s.shadows);
  // Material propio cuando se anima la opacidad mediante una referencia.
  const material = useMemo(() => meshRef ? blobMat.clone() : blobMat, [meshRef]);
  useEffect(() => () => {
    if (material !== blobMat) material.dispose();
  }, [material]);
  if (shadows && !always) return null;
  return <mesh ref={meshRef} visible={!meshRef} geometry={blobGeo} material={material} position={[0, 0.03, 0]} scale={scale} renderOrder={1} userData={{ noToon: true, noBatch: true }} />;
}

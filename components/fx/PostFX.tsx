'use client';

import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRenderQuality } from './AdaptiveQuality';

/**
 * Misma paleta en ambas rutas: saturación adicional 0 y viñeta común en Game.
 * El bloom toma luminancia HDR antes de Neutral, con umbral sobre los blancos.
 * Sin compositor, Neutral se aplica directamente en el renderer.
 */
export default function PostFX() {
  const bloom = useRenderQuality((s) => s.bloom);
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    // Prioridad 0: antes del render directo o del compositor (prioridad 1).
    gl.toneMapping = bloom ? THREE.NoToneMapping : THREE.NeutralToneMapping;
  });
  if (!bloom) return null;
  return (
    <EffectComposer multisampling={2}>
      <Bloom intensity={0.35} luminanceThreshold={2} luminanceSmoothing={0.15} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

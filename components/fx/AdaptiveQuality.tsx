'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';
import { useGameStore, type Quality } from '@/store/gameStore';

interface RenderQuality {
  dpr: number;
  shadows: boolean;
  bloom: boolean;
}

type Feature = 'dpr' | 'shadows' | 'bloom';
const preset = (quality: Quality): RenderQuality => ({
  dpr: 1.25,
  shadows: quality === 'alto',
  bloom: quality === 'alto',
});

// Ajustes temporales: no modifican la preferencia guardada ni localStorage.
export const useRenderQuality = create<RenderQuality>(() => preset(useGameStore.getState().quality));

/** Adaptación también en portada: muestras de 2 s, histéresis y recuperación prudente. */
export default function AdaptiveQuality() {
  const quality = useGameStore((s) => s.quality);
  const stats = useRef({ seconds: 0, frames: 0, good: 0, bad: 0, cooldown: 5 });
  const raised = useRef(new Set<Feature>());
  const blocked = useRef(new Set<Feature>());

  useEffect(() => {
    useRenderQuality.setState(preset(quality));
    stats.current = { seconds: 0, frames: 0, good: 0, bad: 0, cooldown: 5 };
    raised.current.clear();
    blocked.current.clear();
  }, [quality]);

  useFrame((_, dt) => {
    const s = stats.current;
    if (document.hidden || !Number.isFinite(dt) || dt <= 0 || dt > 0.5) {
      s.seconds = s.frames = s.good = s.bad = 0;
      s.cooldown = Math.max(s.cooldown, 3);
      return;
    }
    if (s.cooldown > 0) {
      s.cooldown -= dt;
      return;
    }
    s.seconds += dt;
    s.frames++;
    if (s.seconds < 2) return;
    const fps = s.frames / s.seconds;
    s.bad = fps < 42 ? s.bad + s.seconds : 0;
    s.good = fps > 57 ? s.good + s.seconds : 0;
    s.frames = s.seconds = 0;

    const q = useRenderQuality.getState();
    let feature: Feature | null = null;
    let raise = false;
    if (s.bad >= 4) {
      // Un cambio por vez: resolución, bloom y finalmente sombras.
      feature = q.dpr > 1.25 ? 'dpr' : q.bloom ? 'bloom' : q.shadows ? 'shadows' : null;
    } else if (s.good >= 20) {
      raise = true;
      // Ahorro solo recupera resolución; alto puede recuperar sus efectos.
      if (quality === 'alto' && !q.shadows && !blocked.current.has('shadows')) feature = 'shadows';
      else if (quality === 'alto' && !q.bloom && !blocked.current.has('bloom')) feature = 'bloom';
      else if (q.dpr < 1.5 && !blocked.current.has('dpr')) feature = 'dpr';
    }
    if (!feature) return;

    // Si una subida acaba fallando, no repetirla hasta cambiar el preset.
    if (raise) raised.current.add(feature);
    else if (raised.current.has(feature)) blocked.current.add(feature);
    if (feature === 'dpr') useRenderQuality.setState({ dpr: raise ? 1.5 : 1.25 });
    else if (feature === 'bloom') useRenderQuality.setState({ bloom: raise });
    else useRenderQuality.setState({ shadows: raise });
    s.good = s.bad = 0;
    s.cooldown = 10;
  });
  return null;
}

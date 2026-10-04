'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/** Letrero con emoji + texto dibujado en canvas */
export function Sign({ text, emoji, color, position, width = 6, rotation = 0 }: { text: string; emoji: string; color: string; position: [number, number, number]; width?: number; rotation?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 120, 28);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 120, 28);
    ctx.fill();
    ctx.font = '76px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 70);
    ctx.fillStyle = color;
    const label = text.toUpperCase();
    let fontSize = 54;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    // Dejar margen entre el texto, el emoji y el borde derecho.
    while (ctx.measureText(label).width > 348 && fontSize > 1) {
      fontSize--;
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    }
    ctx.fillText(label, 318, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, emoji, color]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]} userData={{ noToon: true, noBatch: true }}>
      <planeGeometry args={[width, width / 4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}


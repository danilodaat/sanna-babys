'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { player, input, npcPositions } from '@/lib/runtime';
import { getObjective } from '@/lib/objective';
import { fleet } from '@/components/world/Ambulances';
import { BUILDINGS, HOSPITAL, LABELS, PARK, POND, ROADS, type Rect } from '@/lib/mapData';

/*
 * Minimapa circular que gira con la cámara (arriba = hacia donde mira).
 * Se dibuja en un canvas 2D a ~12 fps: barato y sin tocar React por frame.
 * Los objetivos fuera del radio quedan pegados al borde, apuntando hacia ellos.
 */

const SIZE = 112;
const RANGE = 48; // metros de radio visibles

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const R = SIZE / 2;
    const k = R / RANGE;

    const draw = () => {
      const s = useGameStore.getState();
      const a = input.cameraAngle;
      // Adelante de la cámara = (-sin a, -cos a); derecha = (cos a, -sin a)
      const fx = -Math.sin(a);
      const fz = -Math.cos(a);
      const rx = Math.cos(a);
      const rz = -Math.sin(a);
      const px = player.position.x;
      const pz = player.position.z;
      const toScreen = (x: number, z: number): [number, number] => {
        const dx = x - px;
        const dz = z - pz;
        return [R + (dx * rx + dz * rz) * k, R - (dx * fx + dz * fz) * k];
      };
      const rect = (r: Rect, fill: string) => {
        const [cx, cz, w, d] = r;
        const pts = [
          toScreen(cx - w / 2, cz - d / 2),
          toScreen(cx + w / 2, cz - d / 2),
          toScreen(cx + w / 2, cz + d / 2),
          toScreen(cx - w / 2, cz + d / 2),
        ];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R - 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#8FCB78';
      ctx.fillRect(0, 0, SIZE, SIZE);
      rect(PARK, '#83B976');
      const [pwx, pwz] = toScreen(POND.x, POND.z);
      ctx.beginPath();
      ctx.arc(pwx, pwz, POND.r * k, 0, Math.PI * 2);
      ctx.fillStyle = '#4fc3f7';
      ctx.fill();
      ROADS.forEach((r) => rect(r, '#747184'));
      BUILDINGS.forEach((b) => rect(b.rect, b.color));
      rect(HOSPITAL, '#ffffff');

      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      LABELS.forEach((l) => {
        const [x, y] = toScreen(l.x, l.z);
        ctx.fillText(l.text, x, y);
      });

      // Ambulancias
      ctx.font = '12px system-ui, sans-serif';
      for (const u of fleet) {
        const [x, y] = toScreen(u.pos.x, u.pos.z);
        ctx.fillText('🚑', x, y);
      }

      // Objetivos (con pegado al borde si están lejos)
      const obj = s.started ? getObjective(s) : null;
      if (obj) {
        const color = obj.kind === 'offer' ? '#ffc928' : obj.kind === 'emergency' ? '#ff2d2d' : '#ff4f7b';
        const pulse = 1 + Math.sin(performance.now() / 150) * 0.2;
        for (const id of obj.ids) {
          const p = npcPositions.get(id);
          if (!p) continue;
          let [x, y] = toScreen(p.x, p.z);
          const dx = x - R;
          const dy = y - R;
          const d = Math.hypot(dx, dy);
          const edge = R - 10;
          const clamped = d > edge;
          if (clamped) {
            x = R + (dx / d) * edge;
            y = R + (dy / d) * edge;
          }
          ctx.beginPath();
          ctx.arc(x, y, (clamped ? 5 : 6) * (obj.kind === 'emergency' ? pulse : 1), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.fillText(obj.kind === 'offer' ? '!' : '+', x, y + 0.5);
        }
      }
      ctx.restore();

      // Jugador: flecha fija al centro apuntando arriba
      ctx.beginPath();
      ctx.moveTo(R, R - 8);
      ctx.lineTo(R + 6, R + 6);
      ctx.lineTo(R, R + 3);
      ctx.lineTo(R - 6, R + 6);
      ctx.closePath();
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      // Aro
      ctx.beginPath();
      ctx.arc(R, R, R - 2, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
    };

    draw();
    const id = setInterval(draw, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 'calc(max(env(safe-area-inset-top), 10px) + 46px)',
        right: 12,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }}
    />
  );
}

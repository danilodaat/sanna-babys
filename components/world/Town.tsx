'use client';

import { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { TOWN, type TownBuilding } from '@/lib/mapData';
import { Sign } from './Sign';

/*
 * Barrio nuevo: casas (techo a dos aguas), departamentos (varios pisos con
 * balcones) y tiendas (vitrina, toldo a rayas y letrero). Todo sale de
 * lib/mapData.ts → TOWN, así el minimapa y el pasto ya los conocen.
 * La fachada mira a +z local; `rot` la orienta hacia la calle.
 */

const W = '#FAFAFA';

function localSize(b: TownBuilding) {
  const [, , w, d] = b.rect;
  const sideways = Math.abs(Math.abs(b.rot) - Math.PI / 2) < 0.01;
  return sideways ? [d, w] : [w, d];
}

function gable(w: number, d: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2 - 0.35, 0);
  s.lineTo(0, h);
  s.lineTo(d / 2 + 0.35, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.5, bevelEnabled: false });
  g.translate(0, 0, -(w + 0.5) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function Window({ x, y, z, w = 1.1, h = 1 }: { x: number; y: number; z: number; w?: number; h?: number }) {
  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={[w, h, 0.06]} />
      <meshStandardMaterial color="#B3E5FC" emissive="#B3E5FC" emissiveIntensity={0.1} userData={{ night: 'window' }} />
    </mesh>
  );
}

function House({ b }: { b: TownBuilding }) {
  const [w, d] = localSize(b);
  const H = 3.6;
  const roof = useMemo(() => gable(w, d, 2.1), [w, d]);
  return (
    <>
      <mesh castShadow receiveShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[w, H, d]} />
        <meshStandardMaterial color={b.color} />
      </mesh>
      <mesh castShadow geometry={roof} position={[0, H, 0]}>
        <meshStandardMaterial color={b.accent} />
      </mesh>
      <mesh castShadow position={[w / 2 - 1.3, H + 1.5, -d / 4]}>
        <boxGeometry args={[0.55, 1.3, 0.55]} />
        <meshStandardMaterial color="#a1665e" />
      </mesh>
      <mesh position={[0, 1.05, d / 2 + 0.03]}>
        <boxGeometry args={[1.1, 2.1, 0.06]} />
        <meshStandardMaterial color="#8d5a3b" />
      </mesh>
      <Window x={-w / 2 + 1.4} y={2} z={d / 2 + 0.04} />
      <Window x={w / 2 - 1.4} y={2} z={d / 2 + 0.04} />
      {/* Macetero y caminito */}
      <mesh position={[0, 0.035, d / 2 + 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 2]} />
        <meshStandardMaterial color="#FFF4E3" />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 1.2, 0.3, d / 2 + 0.4]}>
          <boxGeometry args={[0.6, 0.5, 0.4]} />
          <meshStandardMaterial color={b.accent} />
        </mesh>
      ))}
    </>
  );
}

function Apartment({ b }: { b: TownBuilding }) {
  const [w, d] = localSize(b);
  const floors = b.floors ?? 3;
  const FH = 3;
  const H = floors * FH;
  const cols = Math.max(2, Math.floor(w / 2.6));
  return (
    <>
      <mesh castShadow receiveShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[w, H, d]} />
        <meshStandardMaterial color={b.color} />
      </mesh>
      <mesh castShadow position={[0, H + 0.2, 0]}>
        <boxGeometry args={[w + 0.4, 0.4, d + 0.4]} />
        <meshStandardMaterial color={b.accent} />
      </mesh>
      {/* Estanque en la azotea */}
      <mesh castShadow position={[w / 4, H + 1.1, -d / 4]}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 12]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      {Array.from({ length: floors }).map((_, f) => (
        <group key={f}>
          {Array.from({ length: cols }).map((__, c) => {
            const x = -w / 2 + (w / cols) * (c + 0.5);
            const y = f * FH + 1.7;
            return (
              <group key={c}>
                <Window x={x} y={y} z={d / 2 + 0.04} w={1.2} h={1.2} />
                <Window x={x} y={y} z={-d / 2 - 0.04} w={1.2} h={1.2} />
                {f > 0 && (
                  <mesh position={[x, y - 0.75, d / 2 + 0.35]}>
                    <boxGeometry args={[1.5, 0.12, 0.7]} />
                    <meshStandardMaterial color={b.accent} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      ))}
      {/* Entrada */}
      <mesh position={[0, 1.2, d / 2 + 0.03]}>
        <boxGeometry args={[1.8, 2.4, 0.06]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh castShadow position={[0, 2.6, d / 2 + 0.7]}>
        <boxGeometry args={[2.6, 0.15, 1.4]} />
        <meshStandardMaterial color={b.accent} />
      </mesh>
    </>
  );
}

function Shop({ b }: { b: TownBuilding }) {
  const [w, d] = localSize(b);
  const H = 4.6;
  const stripes = 8;
  return (
    <>
      <mesh castShadow receiveShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[w, H, d]} />
        <meshStandardMaterial color={b.color} />
      </mesh>
      <mesh castShadow position={[0, H + 0.15, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color="#A99BAE" />
      </mesh>
      {/* Vitrina */}
      <mesh position={[-w / 4, 1.5, d / 2 + 0.04]}>
        <boxGeometry args={[w / 2 - 0.6, 1.8, 0.06]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#fff8e1" emissiveIntensity={0.25} userData={{ night: 'window' }} />
      </mesh>
      <mesh position={[w / 4, 1.2, d / 2 + 0.03]}>
        <boxGeometry args={[1.3, 2.4, 0.06]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* Toldo a rayas */}
      {Array.from({ length: stripes }).map((_, i) => (
        <mesh key={i} castShadow position={[-w / 2 + (w / stripes) * (i + 0.5), 2.95, d / 2 + 0.75]} rotation={[0.45, 0, 0]}>
          <boxGeometry args={[w / stripes, 0.08, 1.6]} />
          <meshStandardMaterial color={i % 2 ? W : b.accent} />
        </mesh>
      ))}
      {b.name && <Sign text={b.name} emoji={b.emoji ?? '🏪'} color={b.accent} position={[0, 3.9, d / 2 + 0.06]} width={Math.min(w - 0.4, 6)} />}
    </>
  );
}

export default function Town() {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group userData={{ batch: true }}>
        {TOWN.map((b, i) => (
          <group key={i} position={[b.rect[0], 0, b.rect[1]]} rotation={[0, b.rot, 0]}>
            {b.kind === 'house' && <House b={b} />}
            {b.kind === 'apartment' && <Apartment b={b} />}
            {b.kind === 'shop' && <Shop b={b} />}
          </group>
        ))}
      </group>
    </RigidBody>
  );
}

'use client';

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { FLOORS, FLOOR_H, HOSP_D, HOSP_W, SLAB, STAIRS, STAIR_STEPS, ELEVATOR, floorOf, insideHospital } from '@/lib/hospital';
import { player } from '@/lib/runtime';
import { setHidden } from '@/lib/hide';
import { Sign } from './Sign';

/*
 * Hospital Sana de 3 pisos: Emergencias (1), Pediatría (2), Maternidad (3).
 *
 * Cada piso es un grupo con su losa, su mobiliario y 4 paredes separadas.
 * <HospitalCutaway /> hace de "casa de muñecas": estando adentro oculta los
 * pisos de arriba y las paredes que quedan entre la cámara y el doctor.
 * Cada parte se fusiona por su cuenta (batchLocal) para poder ocultarla.
 */

const W = HOSP_W;
const D = HOSP_D;
const H = FLOOR_H;
const T = 0.4; // grosor de muro

type Side = 'N' | 'S' | 'E' | 'W';
export const hospitalParts: { id: string; level: number; side: Side | null; obj: THREE.Object3D; hidden?: boolean }[] = [];
const register = (level: number, side: Side | null, tag = '') => (obj: THREE.Object3D | null) => {
  if (!obj) return;
  const id = `${level}:${side ?? '-'}:${tag}`;
  const i = hospitalParts.findIndex((p) => p.id === id);
  if (i >= 0) hospitalParts[i].obj = obj;
  else hospitalParts.push({ id, level, side, obj });
};

/* ─── Mobiliario ─── */

function Bed({ position, rotation = 0, color = '#81D4FA' }: { position: [number, number, number]; rotation?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.1, 2.2]} />
        <meshStandardMaterial color="#DDDDDD" />
      </mesh>
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[1, 0.15, 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.55, -0.7]}>
        <boxGeometry args={[0.7, 0.12, 0.4]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {([-0.5, 0.5] as const).map((x) =>
        ([-0.9, 0.9] as const).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.12, z]}>
            <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
            <meshStandardMaterial color="#AAAAAA" />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.65, -1]}>
        <boxGeometry args={[1.2, 0.5, 0.05]} />
        <meshStandardMaterial color="#CCCCCC" />
      </mesh>
    </group>
  );
}

function Reception({ position, color = '#8D6E63' }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 1, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[4.2, 0.1, 1.4]} />
        <meshStandardMaterial color="#A1887F" />
      </mesh>
      <mesh castShadow position={[0.8, 1.5, -0.1]}>
        <boxGeometry args={[0.8, 0.6, 0.05]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0.8, 1.5, -0.07]}>
        <boxGeometry args={[0.7, 0.5, 0.01]} />
        <meshStandardMaterial color="#B3E5FC" emissive="#B3E5FC" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** Camilla de emergencias con cortina */
function Stretcher({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[0.9, 0.12, 2]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.06, 1.8]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      {([-0.35, 0.35] as const).map((x) =>
        ([-0.8, 0.8] as const).map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.36, z]}>
            <cylinderGeometry args={[0.03, 0.03, 0.72, 6]} />
            <meshStandardMaterial color="#b0bec5" />
          </mesh>
        )),
      )}
      {/* Cortina hacia el pasillo */}
      <mesh position={[1.3, 1.3, 0]}>
        <boxGeometry args={[0.04, 2.3, 2.6]} />
        <meshStandardMaterial color="#80cbc4" />
      </mesh>
      {/* Monitor */}
      <mesh position={[-0.2, 1.9, -1.2]}>
        <boxGeometry args={[0.6, 0.45, 0.08]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh position={[-0.2, 1.9, -1.15]}>
        <boxGeometry args={[0.5, 0.35, 0.01]} />
        <meshStandardMaterial color="#69f0ae" emissive="#69f0ae" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function Chairs({ position, n = 4, color = '#ffb74d', rotation = 0 }: { position: [number, number, number]; n?: number; color?: string; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: n }).map((_, i) => (
        <group key={i} position={[i * 0.8 - ((n - 1) * 0.8) / 2, 0, 0]}>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[0.6, 0.1, 0.55]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh castShadow position={[0, 0.8, -0.25]}>
            <boxGeometry args={[0.6, 0.6, 0.08]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[n * 0.8, 0.06, 0.4]} />
        <meshStandardMaterial color="#78909c" />
      </mesh>
    </group>
  );
}

/** Cunita con recién nacido (decorativo) */
function Bassinet({ position, blanket }: { position: [number, number, number]; blanket: string }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[0.8, 0.35, 0.55]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      <mesh position={[0, 0.9, 0.05]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial color={blanket} />
      </mesh>
      <mesh position={[0, 0.93, -0.17]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#ffe0bd" />
      </mesh>
    </group>
  );
}

/** Cabina del ascensor (visual + paredes); se repite en cada piso */
function ElevatorCabin({ color }: { color: string }) {
  const { x, z, w, d } = ELEVATOR;
  const front = z + d / 2;
  const side = x + w / 2;
  return (
    <group>
      <mesh position={[side, 1.6, z]}>
        <boxGeometry args={[0.15, 3.2, d]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      {/* Marco de la puerta */}
      <mesh position={[x - w / 2 + 0.25, 1.6, front]}>
        <boxGeometry args={[0.3, 3.2, 0.2]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      <mesh position={[side - 0.1, 1.6, front]}>
        <boxGeometry args={[0.3, 3.2, 0.2]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      <mesh position={[x, 3.3, front]}>
        <boxGeometry args={[w, 0.3, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Piso de la cabina */}
      <mesh receiveShadow position={[x, 0.09, z]}>
        <boxGeometry args={[w - 0.2, 0.04, d - 0.2]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      {/* Panel de botones */}
      <mesh position={[side - 0.1, 1.3, z + 0.6]}>
        <boxGeometry args={[0.04, 0.6, 0.3]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffd54f" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Baranda con colisión */
function Rail({ a, b, y = 0 }: { a: [number, number]; b: [number, number]; y?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return (
    <group position={[cx, y, cz]} rotation={[0, -rot, 0]}>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[len, 0.08, 0.08]} />
        <meshStandardMaterial color="#78909c" />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[len, 1, 0.03]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/* ─── Piezas de un piso ─── */

function Slab({ rects, color }: { rects: [number, number, number, number][]; color: string }) {
  // rects: [x0, x1, z0, z1]
  return (
    <>
      {rects.map(([x0, x1, z0, z1], i) => (
        <mesh key={i} receiveShadow position={[(x0 + x1) / 2, -SLAB / 2, (z0 + z1) / 2]}>
          <boxGeometry args={[x1 - x0, SLAB, z1 - z0]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

function WindowRow({ z, facing, color, xs, y = 2.4 }: { z: number; facing: 1 | -1; color: string; xs: number[]; y?: number }) {
  return (
    <>
      {xs.map((x) => (
        <group key={x} position={[x, y, z + facing * (T / 2 + 0.03)]}>
          <mesh>
            <boxGeometry args={[2, 1.6, 0.06]} />
            <meshStandardMaterial color="#B3E5FC" emissive="#B3E5FC" emissiveIntensity={0.12} userData={{ night: 'window' }} />
          </mesh>
          <mesh position={[0, -0.9, facing * 0.05]}>
            <boxGeometry args={[2.3, 0.14, 0.12]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Walls({ level }: { level: number }) {
  const f = FLOORS[level];
  const band = (
    <meshStandardMaterial color={f.color} />
  );
  return (
    <>
      {/* Fondo (N) */}
      <group ref={register(level, 'N')} userData={{ batchLocal: true }}>
        <mesh castShadow position={[0, H / 2, -D / 2]}>
          <boxGeometry args={[W, H, T]} />
          <meshStandardMaterial color="#FAFAFA" />
        </mesh>
        <mesh position={[0, H - 0.25, -D / 2 - T / 2 - 0.02]}>
          <boxGeometry args={[W, 0.3, 0.05]} />
          {band}
        </mesh>
        <WindowRow z={-D / 2} facing={-1} color={f.color} xs={[-7, -2, 3, 8]} />
      </group>

      {/* Costado oeste (W) */}
      <group ref={register(level, 'W')} userData={{ batchLocal: true }}>
        <mesh castShadow position={[-W / 2, H / 2, 0]}>
          <boxGeometry args={[T, H, D]} />
          <meshStandardMaterial color="#F5F5F5" />
        </mesh>
        <mesh position={[-W / 2 - T / 2 - 0.02, H - 0.25, 0]}>
          <boxGeometry args={[0.05, 0.3, D]} />
          {band}
        </mesh>
      </group>

      {/* Costado este (E) — en el piso 1 tiene la puerta a la base de ambulancias */}
      <group ref={register(level, 'E')} userData={{ batchLocal: true }}>
        {level === 0 ? (
          <>
            <mesh castShadow position={[W / 2, H / 2, -(D / 2 + 1.6) / 2]}>
              <boxGeometry args={[T, H, D / 2 - 1.6]} />
              <meshStandardMaterial color="#F5F5F5" />
            </mesh>
            <mesh castShadow position={[W / 2, H / 2, (D / 2 + 1.6) / 2]}>
              <boxGeometry args={[T, H, D / 2 - 1.6]} />
              <meshStandardMaterial color="#F5F5F5" />
            </mesh>
            <mesh castShadow position={[W / 2, 3.9, 0]}>
              <boxGeometry args={[T, 1.2, 3.2]} />
              <meshStandardMaterial color="#F5F5F5" />
            </mesh>
            {/* Techo de la base de ambulancias */}
            <mesh castShadow position={[W / 2 + 3.4, 4.1, 0]}>
              <boxGeometry args={[6.4, 0.25, 17]} />
              <meshStandardMaterial color="#ef5350" />
            </mesh>
            {[-8, 8].map((z) => (
              <mesh key={z} castShadow position={[W / 2 + 3.4, 2.05, z]}>
                <cylinderGeometry args={[0.12, 0.12, 4.1, 8]} />
                <meshStandardMaterial color="#eceff1" />
              </mesh>
            ))}
            <Sign text="Ambulancias" emoji="🚑" color="#ef5350" position={[W / 2 + T / 2 + 0.06, 3.9, 0]} width={3.2} rotation={Math.PI / 2} />
          </>
        ) : (
          <mesh castShadow position={[W / 2, H / 2, 0]}>
            <boxGeometry args={[T, H, D]} />
            <meshStandardMaterial color="#F5F5F5" />
          </mesh>
        )}
        <mesh position={[W / 2 + T / 2 + 0.02, H - 0.25, 0]}>
          <boxGeometry args={[0.05, 0.3, D]} />
          {band}
        </mesh>
      </group>

      {/* Fachada (S) */}
      <group ref={register(level, 'S')} userData={{ batchLocal: true }}>
        {level === 0 ? (
          <>
            {/* Entrada principal: hueco x ∈ [-2, 2] hasta 4.2 m */}
            <mesh castShadow position={[-(W / 2 + 2) / 2, H / 2, D / 2]}>
              <boxGeometry args={[W / 2 - 2, H, T]} />
              <meshStandardMaterial color="#FAFAFA" />
            </mesh>
            <mesh castShadow position={[(W / 2 + 2) / 2, H / 2, D / 2]}>
              <boxGeometry args={[W / 2 - 2, H, T]} />
              <meshStandardMaterial color="#FAFAFA" />
            </mesh>
            <mesh castShadow position={[0, 4.35, D / 2]}>
              <boxGeometry args={[4, 0.3, T]} />
              <meshStandardMaterial color="#FAFAFA" />
            </mesh>
            {/* Alero de la entrada */}
            <mesh castShadow position={[0, 4.1, D / 2 + 1.2]}>
              <boxGeometry args={[6, 0.2, 2.4]} />
              <meshStandardMaterial color={f.color} />
            </mesh>
            <WindowRow z={D / 2} facing={1} color={f.color} xs={[-8, -4.5, 4.5, 8]} />
          </>
        ) : (
          <>
            <mesh castShadow position={[0, H / 2, D / 2]}>
              <boxGeometry args={[W, H, T]} />
              <meshStandardMaterial color="#FAFAFA" />
            </mesh>
            <WindowRow z={D / 2} facing={1} color={f.color} xs={[-9, -5.5, 5.5, 9]} />
          </>
        )}
        <mesh position={[0, H - 0.25, D / 2 + T / 2 + 0.02]}>
          <boxGeometry args={[W, 0.3, 0.05]} />
          {band}
        </mesh>
        <Sign text={f.name} emoji={f.emoji} color={f.color} position={[0, level === 0 ? 4.9 - 0.5 : 2.5, D / 2 + T / 2 + 0.06]} width={level === 0 ? 4.4 : 6} />
      </group>
    </>
  );
}

/* ─── Mobiliario de cada piso ─── */

function EmergencyFloor() {
  return (
    <>
      <Reception position={[0, 0.1, -5]} color="#e57373" />
      {/* Boxes de atención con cortinas */}
      {[-1.5, 2, 5.5].map((z) => (
        <Stretcher key={z} position={[-9.6, 0.1, z]} />
      ))}
      <Chairs position={[7.5, 0.1, 7.2]} n={5} color="#ef9a9a" rotation={Math.PI} />
      <Chairs position={[7.5, 0.1, 3.4]} n={5} color="#ef9a9a" />
      {/* Carro de paro */}
      <group position={[-6.4, 0.1, -3.2]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.8, 1.1, 0.6]} />
          <meshStandardMaterial color="#e53935" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.6, 0.2, 0.45]} />
          <meshStandardMaterial color="#fdd835" />
        </mesh>
      </group>
      {/* Línea roja guía en el piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.5, 0.115, 2]}>
        <planeGeometry args={[0.35, 12]} />
        <meshStandardMaterial color="#ef5350" />
      </mesh>
    </>
  );
}

function PediatricFloor() {
  return (
    <>
      <Reception position={[0, 0.1, -2.2]} color="#64b5f6" />
      <Bed position={[-9.6, 0.1, 1]} color="#ffcc80" />
      <Bed position={[-9.6, 0.1, 4.6]} color="#a5d6a7" />
      <Bed position={[9.8, 0.1, 1.5]} color="#ce93d8" />
      <Chairs position={[3, 0.1, 8.2]} n={4} color="#90caf9" rotation={Math.PI} />
      {/* Globos */}
      {['#ef5350', '#ffee58', '#42a5f5', '#66bb6a'].map((c, i) => (
        <group key={c} position={[-1.5 + i * 0.35, 0, -1.6]}>
          <mesh position={[0, 3.2 + (i % 2) * 0.3, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 1.8, 3]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {/* Medidor de estatura (jirafa) */}
      <mesh position={[-5, 1.6, -8.75]}>
        <boxGeometry args={[0.5, 3, 0.05]} />
        <meshStandardMaterial color="#ffd54f" />
      </mesh>
    </>
  );
}

function MaternityFloor() {
  const glass = { color: '#e1f5fe', transparent: true, opacity: 0.3 } as const;
  return (
    <>
      {[-2, 1.5, 5].map((z, i) => (
        <Bed key={z} position={[-9.6, 0.1, z]} color={['#f8bbd0', '#e1bee7', '#ffe0b2'][i]} />
      ))}
      {/* Sala de cunitas con vidrio (puerta al oeste, z 4..6) */}
      <group>
        <mesh position={[7, 1.3, 1.5]}>
          <boxGeometry args={[8, 2.6, 0.08]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[3, 1.3, 2.75]}>
          <boxGeometry args={[0.08, 2.6, 2.5]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[3, 1.3, 7.25]}>
          <boxGeometry args={[0.08, 2.6, 2.5]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[7, 2.75, 1.5]}>
          <boxGeometry args={[8, 0.3, 0.12]} />
          <meshStandardMaterial color="#f48fb1" />
        </mesh>
        {[
          [5, 3.2, '#f8bbd0'],
          [7, 3.2, '#bbdefb'],
          [9, 3.2, '#fff59d'],
          [5, 6.6, '#c8e6c9'],
          [7, 6.6, '#f8bbd0'],
          [9, 6.6, '#bbdefb'],
        ].map(([x, z, c]) => (
          <Bassinet key={`${x}${z}`} position={[x as number, 0.1, z as number]} blanket={c as string} />
        ))}
        {/* Mecedora */}
        <mesh castShadow position={[4.2, 0.55, 5]}>
          <boxGeometry args={[0.7, 0.1, 0.7]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
      </group>
      <Chairs position={[-2, 0.1, 8.2]} n={3} color="#f8bbd0" rotation={Math.PI} />
      {/* Cigüeña: nube con corazón en la pared */}
      <mesh position={[-3, 2.6, -8.75]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[-3, 2.6, -8.3]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#ec407a" />
      </mesh>
    </>
  );
}

/* ─── Escalera (visual, sin colisión: el doctor se pega a la rampa) ─── */

function StairsVisual() {
  const steps = STAIR_STEPS;
  return (
    <group>
      {STAIRS.map((f, fi) => (
        // El tramo 2 está sobre el piso 2: se oculta junto con él
        <group key={fi} ref={register(fi, null, `stairs${fi}`)} userData={{ batchLocal: true }}>
          {Array.from({ length: steps }).map((_, i) => {
            const t0 = i / steps;
            const t1 = (i + 1) / steps;
            const xa = THREE.MathUtils.lerp(f.x0, f.x1, t0);
            const xb = THREE.MathUtils.lerp(f.x0, f.x1, t1);
            const top = Math.max(THREE.MathUtils.lerp(f.y0, f.y1, t0), THREE.MathUtils.lerp(f.y0, f.y1, t1));
            const bottom = Math.min(f.y0, f.y1);
            const h = top - bottom;
            return (
              <mesh key={i} castShadow receiveShadow position={[(xa + xb) / 2, bottom + h / 2, (f.z0 + f.z1) / 2]}>
                <boxGeometry args={[Math.abs(xb - xa) + 0.01, h, f.z1 - f.z0]} />
                <meshStandardMaterial color={i % 2 ? '#cfd8dc' : '#eceff1'} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/* ─── Casa de muñecas: ocultar lo que tapa la vista estando adentro ─── */

function HospitalCutaway() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const inside = insideHospital(player.position.x, player.position.z);
    const floor = floorOf(player.position.y);
    const c = camera.position;
    let changed = false;
    const want = new Map<string, boolean>();
    for (const p of hospitalParts) {
      let visible = true;
      if (inside) {
        if (p.level > floor) visible = false;
        else if (p.level === floor && p.side) {
          // Ocultar la pared si la cámara está del otro lado
          if (p.side === 'S') visible = c.z < D / 2 - 0.5;
          if (p.side === 'N') visible = c.z > -D / 2 + 0.5;
          if (p.side === 'E') visible = c.x < W / 2 - 0.5;
          if (p.side === 'W') visible = c.x > -W / 2 + 0.5;
        }
      }
      want.set(p.id, !visible);
      if (p.hidden !== !visible) changed = true;
    }
    if (!changed) return;
    // Aplicar primero los pisos completos y después paredes/escaleras (que están adentro)
    const isWholeFloor = (p: (typeof hospitalParts)[number]) => p.side === null && p.id.endsWith(':');
    const ordered = [...hospitalParts].sort((a, b) => Number(!isWholeFloor(a)) - Number(!isWholeFloor(b)));
    for (const p of ordered) {
      const h = want.get(p.id)!;
      setHidden(p.obj, h);
      p.hidden = h;
    }
  });
  return null;
}

/* ─── Hospital ─── */

export function Hospital() {
  const L = [2, 11, -8.75, -6.8]; // hueco tramo 1 (en la losa del piso 2)
  const B = [2, 11, -6.6, -4.65]; // hueco tramo 2 (en la losa del piso 3)
  const X0 = -W / 2;
  const X1 = W / 2;
  const Z0 = -D / 2;
  const Z1 = D / 2;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh">
        {/* ── Piso 1 · Emergencias ── */}
        <group ref={register(0, null)} position={[0, 0, 0]}>
          <group userData={{ batchLocal: true }}>
            <mesh receiveShadow position={[0, 0.01, 0]}>
              <boxGeometry args={[W, 0.15, D]} />
              <meshStandardMaterial color={FLOORS[0].floor} />
            </mesh>
            {Array.from({ length: 8 }).map((_, ix) =>
              Array.from({ length: 6 }).map((_, iz) => (
                <mesh key={`t${ix}-${iz}`} receiveShadow position={[-W / 2 + 1.5 + ix * 3, 0.1, -D / 2 + 1.5 + iz * 3]}>
                  <boxGeometry args={[2.8, 0.02, 2.8]} />
                  <meshStandardMaterial color={(ix + iz) % 2 === 0 ? '#F5F5F5' : '#ffebee'} />
                </mesh>
              )),
            )}
            <EmergencyFloor />
            <ElevatorCabin color={FLOORS[0].color} />
            {/* La escalera solo se sube desde su pie (x ≈ 2) */}
            <Rail a={[3, -6.7]} b={[11.8, -6.7]} />
          </group>
          <Walls level={0} />
        </group>

        {/* ── Piso 2 · Pediatría ── */}
        <group ref={register(1, null)} position={[0, H, 0]}>
          <group userData={{ batchLocal: true }}>
            <Slab
              color={FLOORS[1].floor}
              rects={[
                [X0, X1, L[3], Z1],
                [X0, L[0], Z0, L[3]],
                [L[1], X1, Z0, L[3]],
              ]}
            />
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 2]}>
              <planeGeometry args={[W - 1, 13.5]} />
              <meshStandardMaterial color="#e3f2fd" />
            </mesh>
            <PediatricFloor />
            <ElevatorCabin color={FLOORS[1].color} />
            <Rail a={[2, -6.7]} b={[10.4, -6.7]} />
            <Rail a={[1.9, -8.75]} b={[1.9, -6.7]} />
            <Rail a={[2, -4.55]} b={[10.2, -4.55]} />
          </group>
          <Walls level={1} />
        </group>

        {/* ── Piso 3 · Maternidad ── */}
        <group ref={register(2, null)} position={[0, H * 2, 0]}>
          <group userData={{ batchLocal: true }}>
            <Slab
              color={FLOORS[2].floor}
              rects={[
                [X0, X1, B[3], Z1],
                [X0, X1, Z0, B[2]],
                [X0, B[0], B[2], B[3]],
                [B[1], X1, B[2], B[3]],
              ]}
            />
            <MaternityFloor />
            <ElevatorCabin color={FLOORS[2].color} />
            <Rail a={[2.6, -6.7]} b={[11.8, -6.7]} />
            <Rail a={[2.6, -4.55]} b={[11.8, -4.55]} />
            <Rail a={[11.2, -6.6]} b={[11.2, -4.65]} />
          </group>
          <Walls level={2} />
        </group>

        {/* ── Techo, helipuerto y cruz (se ocultan con el piso 3) ── */}
        <group ref={register(3, null)} position={[0, H * 3, 0]} userData={{ batchLocal: true }}>
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[W + 1, 0.3, D + 1]} />
            <meshStandardMaterial color="#B0BEC5" />
          </mesh>
          <mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[5, 32]} />
            <meshStandardMaterial color="#546e7a" />
          </mesh>
          {/* H del helipuerto */}
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} position={[x, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.6, 4]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.2, 0.6]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Cruz roja gigante sobre la fachada */}
          <group position={[0, 1.8, D / 2 + 0.2]}>
            <mesh>
              <boxGeometry args={[0.9, 2.8, 0.3]} />
              <meshStandardMaterial color="#E53935" />
            </mesh>
            <mesh>
              <boxGeometry args={[2.8, 0.9, 0.3]} />
              <meshStandardMaterial color="#E53935" />
            </mesh>
          </group>
        </group>
      </RigidBody>
      <StairsVisual />
      <HospitalCutaway />
    </>
  );
}

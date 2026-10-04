import * as THREE from 'three';

/**
 * Medidas del Hospital Sana (3 pisos). Lo usan el edificio, el ascensor,
 * las escaleras, la cámara, los NPCs y la flecha de objetivo.
 *
 *  Piso 1 (y = 0)   · Emergencias — entrada principal y bahía de ambulancias
 *  Piso 2 (y = 4.5) · Pediatría
 *  Piso 3 (y = 9)   · Maternidad
 */

export const HOSP_W = 24; // x ∈ [-12, 12]
export const HOSP_D = 18; // z ∈ [-9, 9]
export const FLOOR_H = 4.5;
export const FLOORS_N = 3;
export const STAIR_STEPS = 18; // peldaños visuales por tramo
export const SLAB = 0.3;

export interface FloorInfo {
  name: string;
  emoji: string;
  /** color de la fachada y del piso de ese nivel */
  color: string;
  floor: string;
}

export const FLOORS: FloorInfo[] = [
  { name: 'Emergencias', emoji: '🚑', color: '#ef5350', floor: '#eceff1' },
  { name: 'Pediatría', emoji: '🧸', color: '#42a5f5', floor: '#e3f2fd' },
  { name: 'Maternidad', emoji: '👶', color: '#f48fb1', floor: '#fce4ec' },
];

export const floorBase = (f: number) => f * FLOOR_H;

export function insideHospital(x: number, z: number, margin = 0) {
  return Math.abs(x) < HOSP_W / 2 - 0.3 + margin && Math.abs(z) < HOSP_D / 2 - 0.3 + margin;
}

/** Piso en el que está algo (solo tiene sentido dentro del hospital) */
export function floorOf(y: number) {
  return THREE.MathUtils.clamp(Math.round((y - 0.2) / FLOOR_H), 0, FLOORS_N - 1);
}

/** Ascensor: cabina en la esquina trasera izquierda. [x, z, ancho, largo] */
export const ELEVATOR = { x: -9.9, z: -7.1, w: 3.2, d: 3.2 };
export function inElevator(x: number, z: number) {
  return Math.abs(x - ELEVATOR.x) < ELEVATOR.w / 2 - 0.2 && Math.abs(z - ELEVATOR.z) < ELEVATOR.d / 2 - 0.2;
}
/** Punto frente a la puerta del ascensor (para la flecha) */
export const ELEVATOR_FRONT = new THREE.Vector3(ELEVATOR.x, 0, ELEVATOR.z + 1.2);

/** Puerta principal (piso 1, fachada) */
export const MAIN_DOOR = new THREE.Vector3(0, 0, HOSP_D / 2 + 1.5);

/**
 * Escalera en dos tramos junto a la pared del fondo.
 * Tramo 1: piso 1 → 2, carril A, sube hacia +x.
 * Tramo 2: piso 2 → 3, carril B, sube hacia -x.
 * El doctor se "pega" a la rampa (Doctor.tsx), así no hace falta física de escalones.
 */
export interface Flight {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** altura en x0 y en x1 */
  y0: number;
  y1: number;
}

export const STAIRS: Flight[] = [
  { x0: 2, x1: 11, z0: -8.75, z1: -6.8, y0: 0, y1: FLOOR_H },
  { x0: 2, x1: 11, z0: -6.6, z1: -4.65, y0: FLOOR_H * 2, y1: FLOOR_H },
];

export function stairHeightAt(x: number, z: number, y: number): number | null {
  for (const f of STAIRS) {
    if (x < f.x0 - 0.1 || x > f.x1 + 0.1 || z < f.z0 || z > f.z1) continue;
    const t = THREE.MathUtils.clamp((x - f.x0) / (f.x1 - f.x0), 0, 1);
    const h = THREE.MathUtils.lerp(f.y0, f.y1, t);
    if (Math.abs(h - y) < 1.3) return h;
  }
  return null;
}

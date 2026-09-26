import { ROADS, type Rect } from './mapData';
import { floorBase, floorOf, insideHospital } from './hospital';

/**
 * Altura del suelo en un punto, para apoyar a los personajes sin física
 * (vecinos, gatos) y alinear los pies de los NPCs.
 *   pasto −0.05 · calle +0.02 · vereda +0.155 · hospital: piso de cada nivel
 * Las veredas son las de components/world/City.tsx (caja de 0.15 en y=0.08).
 */

export const GRASS_Y = -0.05;
const ROAD_Y = 0.02;
const SIDEWALK_Y = 0.155;
const HOSPITAL_FLOOR1_Y = 0.11; // baldosas sobre la losa del piso 1

export const SIDEWALKS: Rect[] = [
  [0, 13, 120, 1.5],
  [0, 23, 120, 1.5],
  [15.5, 0, 1.5, 60],
  [24.5, 0, 1.5, 60],
  [-20.5, 0, 1.5, 60],
  [-29.5, 0, 1.5, 60],
];

const inRect = (x: number, z: number, [cx, cz, w, d]: Rect) => Math.abs(x - cx) <= w / 2 && Math.abs(z - cz) <= d / 2;

export function groundHeight(x: number, z: number, y = 0): number {
  if (insideHospital(x, z)) {
    const f = floorOf(y);
    return f === 0 ? HOSPITAL_FLOOR1_Y : floorBase(f) + 0.01;
  }
  for (const r of SIDEWALKS) if (inRect(x, z, r)) return SIDEWALK_Y;
  for (const r of ROADS) if (inRect(x, z, r)) return ROAD_Y;
  return GRASS_Y;
}

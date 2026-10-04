/**
 * Planta de la ciudad para el minimapa y la vegetación. Rectángulos
 * centrados: [x, z, ancho, largo]. Residencial Sol y la escuela se generan
 * desde aquí; el resto de City.tsx está copiado a mano (mantener en sync).
 */

export type Rect = [number, number, number, number];

/** Calle Sol, la calle interna del barrio residencial */
export const RESIDENCIAL_LANE: Rect = [-45.5, -9, 33, 6];

export const RESIDENCIAL_HOUSES: { x: number; z: number; facing: 1 | -1; color: string; roof: string }[] = [
  { x: -36, z: 0, facing: -1, color: '#F4E2B8', roof: '#C5A174' },
  { x: -45, z: 0, facing: -1, color: '#F8BBD0', roof: '#B97F96' },
  { x: -54, z: 0, facing: -1, color: '#B3E5FC', roof: '#7F96B4' },
  { x: -36, z: -18, facing: 1, color: '#C8E6C9', roof: '#789D7C' },
  { x: -45, z: -18, facing: 1, color: '#E1BEE7', roof: '#9D87B0' },
  { x: -54, z: -18, facing: 1, color: '#FFCCBC', roof: '#B28B80' },
];

export const SCHOOL: Rect = [36, 33, 16, 9];

/**
 * Barrio nuevo alrededor del centro: casas, departamentos y tiendas.
 * rect en coordenadas de mundo; `rot` gira la fachada (0 = mira a +z).
 */
export type TownKind = 'house' | 'apartment' | 'shop';
export interface TownBuilding {
  rect: Rect;
  kind: TownKind;
  color: string;
  accent: string;
  rot: number;
  floors?: number;
  name?: string;
  emoji?: string;
}
const PI = Math.PI;
export const TOWN: TownBuilding[] = [
  // Segundo barrio al sur
  { rect: [-14, 47, 7, 6], kind: 'house', color: '#FFE0B2', accent: '#B28B80', rot: PI },
  { rect: [-2, 47, 7, 6], kind: 'house', color: '#C5CAE9', accent: '#858DB4', rot: PI },
  { rect: [12, 47, 9, 8], kind: 'apartment', color: '#B2DFDB', accent: '#79A29A', rot: PI, floors: 3 },
  { rect: [26, 44.5, 8, 6], kind: 'shop', color: '#FFF9C4', accent: '#FBC02D', rot: PI, name: 'Librería', emoji: '📚' },
  { rect: [40, 46, 7, 6], kind: 'house', color: '#F8BBD0', accent: '#B97F96', rot: PI },
  // Este
  { rect: [54, 32, 8, 8], kind: 'apartment', color: '#D1C4E9', accent: '#9D87B0', rot: -PI / 2, floors: 4 },
  { rect: [52, 6, 8, 10], kind: 'shop', color: '#E8F5E9', accent: '#43A047', rot: -PI / 2, name: 'Supermercado', emoji: '🛒' },
  { rect: [52, -10, 8, 8], kind: 'apartment', color: '#FFECB3', accent: '#C5A174', rot: -PI / 2, floors: 3 },
  // Noreste, frente a la calle sur
  { rect: [30, -30, 8, 6], kind: 'shop', color: '#FFCDD2', accent: '#E53935', rot: 0, name: 'Juguetería', emoji: '🧸' },
  { rect: [41, -30, 8, 6], kind: 'shop', color: '#E1F5FE', accent: '#29B6F6', rot: 0, name: 'Heladería', emoji: '🍦' },
  { rect: [35, -44, 10, 8], kind: 'apartment', color: '#CFD8DC', accent: '#455A64', rot: 0, floors: 4 },
  // Norte, detrás del café y la panadería
  { rect: [-12, -42, 9, 8], kind: 'apartment', color: '#F0F4C3', accent: '#A3A178', rot: 0, floors: 3 },
  { rect: [4, -42, 8, 6], kind: 'shop', color: '#FCE4EC', accent: '#EC407A', rot: 0, name: 'Florería', emoji: '🌷' },
  // Noroeste
  { rect: [-38, -34, 8, 6], kind: 'shop', color: '#E0F2F1', accent: '#26A69A', rot: 0, name: 'Veterinaria', emoji: '🐾' },
  { rect: [-52, -36, 7, 6], kind: 'house', color: '#FFF3E0', accent: '#6D4C41', rot: 0 },
  // Oeste del parque
  { rect: [-64, 36, 6, 7], kind: 'house', color: '#DCEDC8', accent: '#829F79', rot: PI / 2 },
];

export const ROADS: Rect[] = [
  [0, 18, 120, 8],
  [20, 0, 8, 120],
  [-25, 0, 8, 60],
  [0, -20, 80, 8],
  RESIDENCIAL_LANE,
];

export const BUILDINGS: { rect: Rect; color: string }[] = [
  { rect: [-15, 32, 8, 7], color: '#F8BBD0' },
  { rect: [-3, 34, 10, 8], color: '#FFF9C4' },
  { rect: [12, 33, 9, 8], color: '#BBDEFB' },
  { rect: SCHOOL, color: '#FFF4E3' },
  { rect: [35, -5, 8, 8], color: '#E0E0E0' },
  { rect: [35, 8, 7, 6], color: '#CE93D8' },
  ...RESIDENCIAL_HOUSES.map((h) => ({ rect: [h.x, h.z, 6, 5.5] as Rect, color: h.color })),
  ...TOWN.map((b) => ({ rect: b.rect, color: b.color })),
  { rect: [-10, -28, 8, 7], color: '#FFAB91' },
  { rect: [5, -30, 9, 6], color: '#FFF3E0' },
];

export const HOSPITAL: Rect = [0, 0, 24, 18];
export const PARK: Rect = [-40, 38, 28, 22];
export const POND = { x: -33, z: 38, r: 3 };

export const LABELS: { x: number; z: number; text: string }[] = [
  { x: 0, z: 0, text: '🏥' },
  { x: -40, z: 38, text: '🌳' },
  { x: 35, z: 32, text: '🏫' },
  { x: 35, z: 8, text: '💊' },
  { x: -45, z: -9, text: '🌞' },
];
